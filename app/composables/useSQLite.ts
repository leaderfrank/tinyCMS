// composables/useSQLite.ts
import { ref, onMounted, onBeforeUnmount } from "vue";
import { sqliteManager, type Customer, type Invoice } from "~/utils/sqliteManager";

export function useSQLite() {
  const isInitialized = ref(false);
  const isInitializing = ref(false);

  const initialize = async () => {
    if (isInitialized.value || isInitializing.value) return;

    isInitializing.value = true;
    try {
      await sqliteManager.initDB();
      isInitialized.value = true;
    } catch (error) {
      console.error("Failed to initialize SQLite:", error);
    } finally {
      isInitializing.value = false;
    }
  };

  // Initialize automatically in client-side
  onMounted(() => {
    if (process.client) {
      initialize();
    }
  });

  // Clean up on unmount
  onBeforeUnmount(() => {
    if (process.client && isInitialized.value) {
      sqliteManager.closeDB();
    }
  });

  return {
    isInitialized,
    isInitializing,
    initialize,

    // Customer operations
    getCustomers: () => sqliteManager.getCustomers(),
    addCustomer: (customer: Customer) => sqliteManager.addCustomer(customer),
    updateCustomer: (customer: Customer) => sqliteManager.updateCustomer(customer),
    deleteCustomer: (id: string) => sqliteManager.deleteCustomer(id),
    searchCustomers: (query: string) => sqliteManager.searchCustomers(query),

    // Invoice operations
    getInvoices: () => sqliteManager.getInvoices(),
    getInvoicesByCustomerId: (customerId: string) => sqliteManager.getInvoicesByCustomerId(customerId),
    addInvoice: (invoice: Invoice) => sqliteManager.addInvoice(invoice),
    updateInvoice: (invoice: Invoice) => sqliteManager.updateInvoice(invoice),
    deleteInvoice: (id: string) => sqliteManager.deleteInvoice(id),
    deleteInvoicesByCustomerId: (customerId: string) => sqliteManager.deleteInvoicesByCustomerId(customerId),

    // Data export/import
    exportToExcel: () => sqliteManager.exportToExcel(),
    importFromExcel: (file: File) => sqliteManager.importFromExcel(file),
    clearAllData: () => sqliteManager.clearAllData(),
  };
}
