// utils/sqliteManager.ts
import initSqlJs, { Database } from "sql.js";

export interface Customer {
  id: string;
  date: string;
  name: string;
  phone: string;
}

export interface Invoice {
  id: string;
  date: string;
  number: string;
  customerId: string;
}

export class SQLiteManager {
  private dbName = "tinyCMS.sqlite";
  private db: Database | null = null;
  private SQL: any = null;
  private readonly customerLimit = 50;
  private dbChangedCallbacks: (() => void)[] = [];

  // Function to load SQL.js
  private async loadSQLJS(): Promise<void> {
    if (this.SQL) return;

    try {
      // Initialize SQL.js (adjust the path as needed)
      this.SQL = await initSqlJs({
        locateFile: (file) => `/sql.js/dist/${file}`,
      });
    } catch (error) {
      console.error("Failed to load SQL.js:", error);
      throw new Error("Failed to load SQL.js");
    }
  }

  // Function to save DB to public folder
  private async saveDB(): Promise<void> {
    if (!this.db) return;

    try {
      const data = this.db.export();
      const blob = new Blob([data], { type: "application/octet-stream" });

      // Save to localStorage as a base64 string (for persistence between sessions)
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => {
        localStorage.setItem("tinyCMS_sqlite", reader.result as string);
      };

      // Notify about DB changes
      this.notifyDBChanged();
    } catch (error) {
      console.error("Error saving database:", error);
      throw new Error("Failed to save database");
    }
  }

  // Function to notify about DB changes
  private notifyDBChanged(): void {
    this.dbChangedCallbacks.forEach((callback) => callback());
  }

  // Register callback for DB changes
  onDBChanged(callback: () => void): void {
    this.dbChangedCallbacks.push(callback);
  }

  // Remove callback
  removeDBChangedCallback(callback: () => void): void {
    const index = this.dbChangedCallbacks.indexOf(callback);
    if (index !== -1) {
      this.dbChangedCallbacks.splice(index, 1);
    }
  }

  async initDB(): Promise<void> {
    try {
      await this.loadSQLJS();

      let dbData: Uint8Array | null = null;

      // Try to load existing database from localStorage
      const storedDB = localStorage.getItem("tinyCMS_sqlite");
      if (storedDB) {
        try {
          // Convert base64 string back to Uint8Array
          const binary = atob(storedDB.split(",")[1]);
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
          }
          dbData = array;
        } catch (e) {
          console.warn("Could not parse stored database, creating new one");
          dbData = null;
        }
      }

      // Create new DB if none exists
      if (!dbData) {
        this.db = new this.SQL.Database();
        await this.createTables();
      } else {
        // Load existing database
        this.db = new this.SQL.Database(dbData);
      }
    } catch (error) {
      console.error("Error initializing database:", error);
      throw new Error("Failed to initialize database");
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    // Create customers table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        name TEXT,
        phone TEXT
      )
    `);

    // Create indexes for customers
    this.db.run("CREATE INDEX IF NOT EXISTS idx_customer_name ON customers (name)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_customer_phone ON customers (phone)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_customer_date ON customers (date)");

    // Create invoices table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        number TEXT,
        customerId TEXT,
        FOREIGN KEY (customerId) REFERENCES customers (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for invoices
    this.db.run("CREATE INDEX IF NOT EXISTS idx_invoice_customerId ON invoices (customerId)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_invoice_date ON invoices (date)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_invoice_number ON invoices (number)");

    // Save the newly created database
    await this.saveDB();
  }

  async addCustomer(customer: Customer): Promise<string> {
    if (!this.db) await this.initDB();

    try {
      this.db!.run("INSERT INTO customers (date, name, phone) VALUES (?, ?, ?)", [
        customer.date,
        customer.name,
        customer.phone,
      ]);

      // Get the last inserted ID
      const result = this.db!.exec("SELECT last_insert_rowid() as id");

      const insertedId = result[0]?.values[0]?.[0].toString();

      await this.saveDB();
      return insertedId!;
    } catch (error) {
      console.error("Error adding customer:", error);
      throw new Error("Failed to add customer");
    }
  }

  async getCustomers(): Promise<Customer[]> {
    if (!this.db) await this.initDB();

    try {
      const result = this.db!.exec(`
        SELECT id, date, name, phone 
        FROM customers 
        ORDER BY date DESC
        LIMIT ${this.customerLimit}
      `);

      if (result.length === 0) return [];

      const customers: Customer[] = [];
      const rows = result[0].values;

      for (const row of rows) {
        customers.push({
          id: row[0] as string,
          date: row[1] as string,
          name: row[2] as string,
          phone: row[3] as string,
        });
      }

      return customers;
    } catch (error) {
      console.error("Error getting customers:", error);
      throw new Error("Failed to get customers");
    }
  }

  async updateCustomer(customer: Customer): Promise<void> {
    if (!this.db) await this.initDB();

    try {
      this.db!.run("UPDATE customers SET date = ?, name = ?, phone = ? WHERE id = ?", [
        customer.date,
        customer.name,
        customer.phone,
        customer.id,
      ]);

      await this.saveDB();
    } catch (error) {
      console.error("Error updating customer:", error);
      throw new Error("Failed to update customer");
    }
  }

  async deleteCustomer(id: string): Promise<void> {
    if (!this.db) await this.initDB();

    try {
      // Delete related invoices first
      await this.deleteInvoicesByCustomerId(id);

      // Then delete the customer
      this.db!.run("DELETE FROM customers WHERE id = ?", [id]);

      await this.saveDB();
    } catch (error) {
      console.error("Error deleting customer:", error);
      throw new Error("Failed to delete customer");
    }
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    if (!this.db) await this.initDB();
    if (!query || query.trim() === "") return this.getCustomers();

    try {
      // Split search query into terms
      const searchTerms = query.trim().toLowerCase().split(/\s+/);
      // Create individual conditions for each term
      // Each term can be found anywhere in name or phone
      const termConditions = searchTerms.map(() => `(LOWER(name) LIKE ? OR LOWER(phone) LIKE ?)`);

      // Join all term conditions with AND to require all terms to match
      const whereClause = termConditions.join(" AND ");

      // Prepare the search arguments for each term with wildcards
      const whereArgs = searchTerms.flatMap((term) => [`%${term}%`, `%${term}%`]);

      const sql = `
        SELECT id, date, name, phone 
        FROM customers 
        WHERE ${whereClause}
        ORDER BY date DESC
        LIMIT ${this.customerLimit}
      `;

      const result = this.db!.exec(sql, whereArgs);
      if (result.length === 0) return [];

      const customers: Customer[] = result[0].values.map((row) => ({
        id: row[0] as string,
        date: row[1] as string,
        name: row[2] as string,
        phone: row[3] as string,
      }));

      return customers;
    } catch (error) {
      console.error("Error searching customers:", error);
      throw new Error("Failed to search customers");
    }
  }

  // Invoice CRUD operations
  async addInvoice(invoice: Invoice): Promise<string> {
    if (!this.db) await this.initDB();

    try {
      this.db!.run("INSERT INTO invoices (date, number, customerId) VALUES (?, ?, ?)", [
        invoice.date,
        invoice.number,
        invoice.customerId,
      ]);

      // Get the last inserted ID
      const result = this.db!.exec("SELECT last_insert_rowid() as id");
      const insertedId = result[0]?.values[0]?.[0].toString();

      await this.saveDB();
      return insertedId!;
    } catch (error) {
      console.error("Error adding invoice:", error);
      throw new Error("Failed to add invoice");
    }
  }

  async getInvoices(): Promise<Invoice[]> {
    if (!this.db) await this.initDB();

    try {
      const result = this.db!.exec(`
        SELECT id, date, number, customerId 
        FROM invoices 
        ORDER BY date DESC, number DESC
      `);

      if (result.length === 0) return [];

      const invoices: Invoice[] = [];
      const rows = result[0].values;

      for (const row of rows) {
        invoices.push({
          id: row[0] as string,
          date: row[1] as string,
          number: row[2] as string,
          customerId: row[3] as string,
        });
      }

      return invoices;
    } catch (error) {
      console.error("Error getting invoices:", error);
      throw new Error("Failed to get invoices");
    }
  }

  async getInvoicesByCustomerId(customerId: string): Promise<Invoice[]> {
    if (!this.db) await this.initDB();

    try {
      const result = this.db!.exec(
        `
        SELECT id, date, number, customerId 
        FROM invoices 
        WHERE customerId = ?
        ORDER BY date DESC, number DESC
      `,
        [customerId]
      );

      if (result.length === 0) return [];

      const invoices: Invoice[] = [];
      const rows = result[0].values;

      for (const row of rows) {
        invoices.push({
          id: row[0] as string,
          date: row[1] as string,
          number: row[2] as string,
          customerId: row[3] as string,
        });
      }

      return invoices;
    } catch (error) {
      console.error("Error getting customer invoices:", error);
      throw new Error("Failed to get customer invoices");
    }
  }

  async updateInvoice(invoice: Invoice): Promise<void> {
    if (!this.db) await this.initDB();

    try {
      this.db!.run("UPDATE invoices SET date = ?, number = ?, customerId = ? WHERE id = ?", [
        invoice.date,
        invoice.number,
        invoice.customerId,
        invoice.id,
      ]);

      await this.saveDB();
    } catch (error) {
      console.error("Error updating invoice:", error);
      throw new Error("Failed to update invoice");
    }
  }

  async deleteInvoice(id: string): Promise<void> {
    if (!this.db) await this.initDB();

    try {
      this.db!.run("DELETE FROM invoices WHERE id = ?", [id]);
      await this.saveDB();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      throw new Error("Failed to delete invoice");
    }
  }

  async deleteInvoicesByCustomerId(customerId: string): Promise<void> {
    if (!this.db) await this.initDB();

    try {
      this.db!.run("DELETE FROM invoices WHERE customerId = ?", [customerId]);
      await this.saveDB();
    } catch (error) {
      console.error("Error deleting customer invoices:", error);
      throw new Error("Failed to delete customer invoices");
    }
  }

  // Export/Import functionality
  async exportToExcel(): Promise<Blob> {
    try {
      const XLSX = await import("xlsx");

      // Get all customers
      const customers = await this.getAllCustomersForExport();

      // Get all invoices
      const invoices = await this.getAllInvoicesForExport();

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Convert data to worksheets
      const customersWS = XLSX.utils.json_to_sheet(customers);
      const invoicesWS = XLSX.utils.json_to_sheet(invoices);

      // Add worksheets to workbook
      XLSX.utils.book_append_sheet(wb, customersWS, "Customers");
      XLSX.utils.book_append_sheet(wb, invoicesWS, "Invoices");

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      return blob;
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      throw new Error("Failed to export data to Excel");
    }
  }

  async importFromExcel(file: File): Promise<{ customersImported: number; invoicesImported: number }> {
    try {
      const XLSX = await import("xlsx");

      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });

            // Process customers
            let customersImported = 0;
            if (workbook.SheetNames.includes("Customers")) {
              const customersWS = workbook.Sheets["Customers"];
              const customers = XLSX.utils.sheet_to_json<Customer>(customersWS);

              // Import customers
              await this.importCustomers(customers);
              customersImported = customers.length;
            }

            // Process invoices
            let invoicesImported = 0;
            if (workbook.SheetNames.includes("Invoices")) {
              const invoicesWS = workbook.Sheets["Invoices"];
              const invoices = XLSX.utils.sheet_to_json<Invoice>(invoicesWS);

              // Import invoices
              await this.importInvoices(invoices);
              invoicesImported = invoices.length;
            }

            resolve({ customersImported, invoicesImported });
          } catch (error) {
            console.error("Error importing Excel:", error);
            reject("Failed to import data");
          }
        };

        reader.onerror = () => {
          reject("Error reading file");
        };

        reader.readAsArrayBuffer(file);
      });
    } catch (error) {
      console.error("Error in importFromExcel:", error);
      throw new Error("Failed to import from Excel");
    }
  }

  // Helper methods for export/import
  async getAllCustomersForExport(): Promise<Customer[]> {
    if (!this.db) await this.initDB();

    try {
      const result = this.db!.exec(`
        SELECT id, date, name, phone 
        FROM customers
      `);

      if (result.length === 0) return [];

      const customers: Customer[] = [];
      const rows = result[0].values;

      for (const row of rows) {
        customers.push({
          id: row[0] as string,
          date: row[1] as string,
          name: row[2] as string,
          phone: row[3] as string,
        });
      }

      return customers;
    } catch (error) {
      console.error("Error getting all customers for export:", error);
      throw new Error("Failed to get all customers for export");
    }
  }

  async getAllInvoicesForExport(): Promise<Invoice[]> {
    if (!this.db) await this.initDB();

    try {
      const result = this.db!.exec(`
        SELECT id, date, number, customerId 
        FROM invoices
      `);

      if (result.length === 0) return [];

      const invoices: Invoice[] = [];
      const rows = result[0].values;

      for (const row of rows) {
        invoices.push({
          id: row[0] as string,
          date: row[1] as string,
          number: row[2] as string,
          customerId: row[3] as string,
        });
      }

      return invoices;
    } catch (error) {
      console.error("Error getting all invoices for export:", error);
      throw new Error("Failed to get all invoices for export");
    }
  }

  // Helper method to import customers
  private async importCustomers(customers: Customer[]): Promise<void> {
    if (!this.db) await this.initDB();

    try {
      // Begin transaction
      this.db!.run("BEGIN TRANSACTION");

      for (const customer of customers) {
        // Ensure required fields exist
        if (!customer.id || !customer.name) continue;

        // Insert or replace customer
        this.db!.run("INSERT OR REPLACE INTO customers (id, date, name, phone) VALUES (?, ?, ?, ?)", [
          customer.id,
          customer.date || new Date().toISOString(),
          customer.name,
          customer.phone || "",
        ]);
      }

      // Commit transaction
      this.db!.run("COMMIT");

      await this.saveDB();
    } catch (error) {
      // Rollback on error
      if (this.db) {
        try {
          this.db.run("ROLLBACK");
        } catch (e) {
          console.error("Rollback error:", e);
        }
      }

      console.error("Error importing customers:", error);
      throw new Error("Failed to import customers");
    }
  }

  // Helper method to import invoices
  private async importInvoices(invoices: Invoice[]): Promise<void> {
    if (!this.db) await this.initDB();

    try {
      // Begin transaction
      this.db!.run("BEGIN TRANSACTION");

      for (const invoice of invoices) {
        // Ensure required fields exist
        if (!invoice.id || !invoice.customerId) continue;

        // Insert or replace invoice
        this.db!.run("INSERT OR REPLACE INTO invoices (id, date, number, customerId) VALUES (?, ?, ?, ?)", [
          invoice.id,
          invoice.date || new Date().toISOString(),
          invoice.number || "",
          invoice.customerId,
        ]);
      }

      // Commit transaction
      this.db!.run("COMMIT");

      await this.saveDB();
    } catch (error) {
      // Rollback on error
      if (this.db) {
        try {
          this.db.run("ROLLBACK");
        } catch (e) {
          console.error("Rollback error:", e);
        }
      }

      console.error("Error importing invoices:", error);
      throw new Error("Failed to import invoices");
    }
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    if (!this.db) await this.initDB();

    try {
      // Begin transaction
      this.db!.run("BEGIN TRANSACTION");

      // Clear all tables
      this.db!.run("DELETE FROM invoices");
      this.db!.run("DELETE FROM customers");

      // Commit transaction
      this.db!.run("COMMIT");

      await this.saveDB();
    } catch (error) {
      // Rollback on error
      if (this.db) {
        try {
          this.db.run("ROLLBACK");
        } catch (e) {
          console.error("Rollback error:", e);
        }
      }

      console.error("Error clearing data:", error);
      throw new Error("Failed to clear data");
    }
  }

  // Close and clean up the database
  async closeDB(): Promise<void> {
    if (this.db) {
      await this.saveDB();
      this.db.close();
      this.db = null;
    }
  }
}

// Create a singleton instance
export const sqliteManager = new SQLiteManager();

export function downloadExcel(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
