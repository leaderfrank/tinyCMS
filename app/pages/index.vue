<script setup lang="ts">
  import type { TableColumn } from "@nuxt/ui";
  const UButton = resolveComponent("UButton");
  const UModal = resolveComponent("UModal");
  const toast = useToast();
  // Data
  const customerRows = ref<Customer[]>([]);
  const invoiceRows = ref<Record<string, Invoice[]>>({});
  const expanded = ref<Record<string, boolean>>({});
  const globalFilter = ref("");
  const colorMode = useColorMode();
  const key = ref(0);
  function forceReload() {
    key.value++;
  }
  const isDark = computed({
    get() {
      return colorMode.value === "dark";
    },
    set(_isDark) {
      colorMode.preference = _isDark ? "dark" : "light";
    },
  });
  // Modals
  const isAddCustomerOpen = ref(false);
  const isAddInvoiceOpen = ref(false);
  const isImporting = ref(false);
  const isExporting = ref(false);
  const importFileInput = ref<HTMLInputElement | null>(null);
  const importResults = ref<{ customersImported: number; invoicesImported: number } | null>(null);
  const showImportResults = ref(false);
  const isDeleteConfirmOpen = ref(false);
  const currentCustomer = ref<Customer | null>(null);
  const currentInvoice = ref<Invoice | null>(null);
  const deleteType = ref<"customer" | "invoice">("customer");
  const deleteId = ref("");

  // Customer form
  const customerForm = ref<Customer>({
    id: "",
    date: new Date().toISOString().split("T")[0] || "",
    name: "",
    phone: "",
  });

  // Invoice form
  const invoiceForm = ref<Invoice>({
    id: "",
    date: new Date().toISOString().split("T")[0] || "",
    number: "",
    customerId: "",
  });

  const customerColumns: TableColumn<Customer>[] = [
    {
      id: "expand",
      cell: ({ row }) =>
        h(UButton, {
          size: "lg",
          color: "neutral",
          variant: "ghost",
          icon: "i-custom-lucide-chevron-down",
          square: true,
          "aria-label": "Expand",
          ui: {
            leadingIcon: ["transition-transform", row.getIsExpanded() ? "duration-200 rotate-180" : ""],
          },
          onClick: async () => {
            await loadInvoicesForCustomer(row.original.id);
            row.toggleExpanded();
          },
        }),
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "phone",
      header: "Phone",
    },
    {
      id: "action",
    },
  ];

  const invoiceColumns: TableColumn<Invoice>[] = [
    {
      accessorKey: "date",
      header: "Date",
    },
    {
      accessorKey: "number",
      header: "Number",
    },
    {
      id: "action",
    },
  ];

  function showToast(message: string, type: "success" | "error" | "warning" = "success") {
    toast.add({
      title: message,
      color: type,
      icon:
        type === "success"
          ? "i-custom-lucide-check-circle"
          : type === "warning"
          ? "i-custom-lucide-alert-triangle"
          : "i-custom-lucide-alert-circle",
    });
  }

  // Data loading functions
  async function loadCustomers(searchTerm: string = "") {
    try {
      customerRows.value = await sqliteManager.searchCustomers(searchTerm);
      forceReload();
    } catch (error) {
      showToast("Failed to load customer data", "error");
    }
  }

  // Load initial data
  onMounted(async () => {
    try {
      await sqliteManager.initDB();
      await loadCustomers();
    } catch (error) {
      showToast("Failed to load data", "error");
    }
  });

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  watch(globalFilter, (newValue) => {
    if (searchTimeout) clearTimeout(searchTimeout);

    searchTimeout = setTimeout(async () => {
      try {
        if (newValue) {
          customerRows.value = await sqliteManager.searchCustomers(newValue);
        } else {
          customerRows.value = await sqliteManager.searchCustomers("");
        }
        forceReload();
      } catch (error) {
        showToast("Error filtering customers", "error");
      }
    }, 300);
  });

  async function loadInvoicesForCustomer(customerId: string) {
    try {
      const invoices = await sqliteManager.getInvoicesByCustomerId(customerId);
      invoiceRows.value = { ...invoiceRows.value, [customerId]: invoices };
    } catch (error) {
      showToast("Error loading invoices", "error");
    }
  }

  async function saveCustomer() {
    try {
      const customerData = {
        id: customerForm.value.id || Date.now().toString(),
        date: customerForm.value.date,
        name: customerForm.value.name,
        phone: customerForm.value.phone,
      };
      if (currentCustomer.value) {
        showToast("Customer updated successfully", "success");
        await sqliteManager.updateCustomer(customerData);
      } else {
        showToast("Customer added successfully", "success");
        await sqliteManager.addCustomer(customerData);
      }
      isAddCustomerOpen.value = false;
      await loadCustomers();
    } catch (error) {
      showToast("Error saving customer", "error");
    }
  }

  // Invoice actions
  async function openAddInvoiceModal(customerId: string) {
    let nextInvoiceNumber = "1";
    try {
      const allInvoices = await sqliteManager.getInvoices();
      if (allInvoices.length > 0) {
        // Sort invoices by number (assuming numbers are numeric)
        const sortedInvoices = allInvoices.sort((a, b) => {
          const numA = parseInt(a.number) || 0;
          const numB = parseInt(b.number) || 0;
          return numB - numA; // Sort in descending order
        });
        // Get the highest invoice number and increment it
        const highestNumber = parseInt(sortedInvoices[0]?.number || "0");
        nextInvoiceNumber = (highestNumber + 1).toString();
      }
    } catch (error) {
      showToast("Error getting next invoice number", "warning");
    }
    invoiceForm.value = {
      id: "",
      date: new Date().toISOString().split("T")[0] || "",
      number: nextInvoiceNumber,
      customerId: customerId,
    };
    currentInvoice.value = null;
  }

  async function saveInvoice() {
    try {
      // Create a clean invoice object with only the required properties
      const invoiceData = {
        id: invoiceForm.value.id || Date.now().toString(),
        date: invoiceForm.value.date,
        number: invoiceForm.value.number,
        customerId: invoiceForm.value.customerId,
      };

      if (currentInvoice.value) {
        // Update existing invoice
        showToast("Invoice updated successfully", "success");
        await sqliteManager.updateInvoice(invoiceData);
      } else {
        // Add new invoice
        showToast("Invoice added successfully", "success");
        await sqliteManager.addInvoice(invoiceData);
      }
      isAddInvoiceOpen.value = false;
      await loadInvoicesForCustomer(invoiceForm.value.customerId);
    } catch (error) {
      showToast("Error saving invoice", "error");
    }
  }
  const deleteCode = ref("");
  const userInputCode = ref("");

  watch(isDeleteConfirmOpen, (open) => {
    if (open) {
      // Generate a new 5-digit code when the modal opens
      deleteCode.value = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join("");
      userInputCode.value = "";
    }
  });

  async function confirmDelete() {
    if (userInputCode.value !== deleteCode.value) {
      showToast("Incorrect confirmation code", "warning");
      return;
    }

    try {
      if (deleteType.value === "customer") {
        await sqliteManager.deleteCustomer(deleteId.value);
        showToast("Customer deleted successfully", "success");
        await loadCustomers();
      } else {
        const invoice = await getInvoiceById(deleteId.value);
        if (invoice) {
          await sqliteManager.deleteInvoice(deleteId.value);
          showToast("Invoice deleted successfully", "success");
          await loadInvoicesForCustomer(invoice.customerId);
        }
      }
      isDeleteConfirmOpen.value = false;
    } catch (error) {
      showToast("Error deleting item", "error");
    }
  }

  async function getInvoiceById(id: string): Promise<Invoice | null> {
    const allInvoices = await sqliteManager.getInvoices();
    return allInvoices.find((invoice) => invoice.id === id) || null;
  }

  // Helper function to get invoices for a specific customer row
  function getInvoicesForCustomer(customerId: string) {
    return invoiceRows.value[customerId] || [];
  }

  // Excel export function
  async function exportToExcel() {
    try {
      isExporting.value = true;
      const blob = await sqliteManager.exportToExcel();
      downloadExcel(blob, `tinycms-export-${new Date().toISOString().split("T")[0]}.xlsx`);
      showToast("Data exported successfully", "success");
    } catch (error) {
      showToast("Error exporting data", "error");
    } finally {
      isExporting.value = false;
    }
  }

  // Excel import functions
  function triggerFileInput() {
    if (importFileInput.value) {
      importFileInput.value.click();
    }
  }

  async function handleFileUpload(event: Event) {
    event.preventDefault();
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const file = target.files[0];

    try {
      isImporting.value = true;
      importResults.value = await sqliteManager.importFromExcel(file!);
      showImportResults.value = true;
      showToast("Data imported successfully", "success");
      await loadCustomers();
      // Reset input so the same file can be selected again
      if (importFileInput.value) {
        importFileInput.value.value = "";
      }
    } catch (error) {
      showToast("Error importing data", "error");
    } finally {
      isImporting.value = false;
    }
  }
</script>

<template>
  <UCard :variant="isDark ? 'soft' : 'outline'" class="m-12">
    <template #header>
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-2">
          <ClientOnly v-if="!colorMode?.forced">
            <UButton
              :icon="isDark ? 'i-custom-lucide-moon' : 'i-custom-lucide-sun'"
              color="neutral"
              variant="ghost"
              @click="isDark = !isDark" />

            <template #fallback>
              <div class="size-8" />
            </template>
          </ClientOnly>
          <h1 class="font-bold text-2xl">tinyCMS</h1>
        </div>
        <UButton
          size="lg"
          variant="ghost"
          icon="i-custom-lucide-plus"
          label="Add new customer"
          @click="
            customerForm = { id: '', date: new Date().toISOString().split('T')[0] || '', name: '', phone: '' };
            currentCustomer = null;
            isAddCustomerOpen = true;
          " />
      </div>
    </template>
    <div class="flex flex-col flex-1 w-full">
      <UInput v-model="globalFilter" class="w-1/2 py-4 my-2" placeholder="Search by name or phone..." size="lg" />
      <UTable
        :key="key"
        :ui="{
          th: 'text-md font-semibold',
          tr: 'data-[expanded=true]:bg-elevated/50',
          td: 'text-md font-semibold',
        }"
        v-model:expanded="expanded"
        :data="customerRows"
        :columns="customerColumns"
        class="flex-1 max-h-[60vh]">
        <template #expanded="{ row }">
          <div class="p-4 bg-elevated/20">
            <div class="flex justify-between items-center mb-4">
              <h3 class="font-semibold">Invoices for {{ (row.original as Customer).name }}</h3>
              <UButton
                size="lg"
                color="primary"
                icon="i-custom-lucide-plus"
                label="Add Invoice"
                @click="
                  openAddInvoiceModal((row.original as Customer).id);
                  isAddInvoiceOpen = true;
                " />
            </div>
            <UCard>
              <UTable
                :data="getInvoicesForCustomer((row.original as Customer).id)"
                :columns="invoiceColumns"
                :ui="{
                  th: 'text-md font-semibold',
                  tr: 'data-[expanded=true]:bg-elevated/50',
                  td: 'text-md font-semibold',
                }"
                class="flex-1 max-h-[40vh]"
                :empty-state="{ icon: 'i-custom-lucide-file', label: 'No invoices found' }">
                <template #action-cell="{ row }">
                  <div class="flex justify-end gap-2">
                    <UButton
                      size="lg"
                      icon="i-custom-lucide-edit"
                      color="primary"
                      variant="ghost"
                      @click="
                        invoiceForm = { ...(row.original as Invoice) };
                        currentInvoice = row.original as Invoice;
                        isAddInvoiceOpen = true;
                      " />
                    <UButton
                      size="lg"
                      icon="i-custom-lucide-trash"
                      color="red"
                      variant="ghost"
                      @click="
                        invoiceForm = { ...(row.original as Invoice) };
                        currentInvoice = row.original as Invoice;
                        deleteType = 'invoice';
                        deleteId = currentInvoice.id;
                        isDeleteConfirmOpen = true;
                      " />
                  </div>
                </template>
              </UTable>
            </UCard>
          </div>
        </template>
        <template #action-cell="{ row }">
          <div class="flex justify-end gap-2">
            <UButton
              size="lg"
              icon="i-custom-lucide-edit"
              color="primary"
              variant="ghost"
              @click="
                customerForm = { ...(row.original as Customer) };
                currentCustomer = row.original as Customer;
                isAddCustomerOpen = true;
              " />
            <UButton
              size="lg"
              icon="i-custom-lucide-trash"
              color="red"
              variant="ghost"
              @click="
                customerForm = { ...(row.original as Customer) };
                currentCustomer = row.original as Customer;
                deleteType = 'customer';
                deleteId = currentCustomer.id;
                isDeleteConfirmOpen = true;
              " />
          </div>
        </template>
        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-12">
            <UIcon name="i-custom-lucide-users" class="text-4xl mb-2" />
            <p class="text-lg font-medium">No customers found</p>
            <p class="text-sm text-gray-500 mb-4">Add your first customer to get started</p>
          </div>
        </template>
      </UTable>
    </div>
    <template #footer>
      <div class="flex items-center justify-end">
        <UButton
          size="lg"
          variant="ghost"
          color="secondary"
          icon="i-custom-lucide-file-spreadsheet"
          :loading="isExporting"
          :disabled="isExporting"
          @click="exportToExcel">
          Export Excel
        </UButton>
        <UButton
          size="lg"
          variant="ghost"
          color="secondary"
          icon="i-custom-lucide-upload"
          :loading="isImporting"
          :disabled="isImporting"
          @click="triggerFileInput">
          Import Excel
        </UButton>
        <!-- Hidden file input -->
        <input ref="importFileInput" type="file" accept=".xlsx" class="hidden" @change="handleFileUpload" />
      </div>
    </template>
  </UCard>
  <!-- Delete Confirmation Modal -->
  <UModal :title="deleteType === 'customer' ? 'Delete Customer' : 'Delete Invoice'" v-model="isDeleteConfirmOpen">
    <template #body>
      <div class="py-4">
        <p>Are you sure you want to delete this {{ deleteType }}?</p>
        <p v-if="deleteType === 'customer'" class="text-sm text-red-500 mt-2">
          Note: This will also delete all associated invoices.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton size="lg" color="gray" variant="ghost" label="Cancel" @click="isDeleteConfirmOpen = false" />
        <UButton size="lg" color="red" variant="solid" label="Delete" @click="confirmDelete" />
      </div>
    </template>
  </UModal>
  <!-- Add Import Results Modal -->
  <UModal v-model="showImportResults" title="Import Results">
    <template #body>
      <div class="py-4">
        <div v-if="importResults">
          <p class="mb-2">Import completed successfully!</p>
          <ul class="list-disc pl-5">
            <li>Customers imported: {{ importResults.customersImported }}</li>
            <li>Invoices imported: {{ importResults.invoicesImported }}</li>
          </ul>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <UButton size="lg" color="primary" variant="solid" label="OK" @click="showImportResults = false" />
      </div>
    </template>
  </UModal>
  <!-- Customer Modal -->
  <UModal
    v-model:open="isAddCustomerOpen"
    :title="currentCustomer ? 'Edit Customer' : 'Add Customer'"
    :ui="{ width: 'sm:max-w-md', footer: 'flex justify-end gap-2' }">
    <template #body>
      <UForm :state="customerForm" @submit="saveCustomer" class="flex flex-wrap gap-4">
        <UFormGroup label="Name" name="name">
          <UInput v-model="customerForm.name" placeholder="Customer name" required />
        </UFormGroup>
        <UFormGroup label="Phone" name="phone">
          <UInput v-model="customerForm.phone" placeholder="Phone number" required />
        </UFormGroup>
        <UFormGroup label="Date" name="date">
          <UInput v-model="customerForm.date" type="date" required />
        </UFormGroup>
      </UForm>
    </template>
    <template #footer>
      <UButton size="lg" color="primary" variant="solid" label="Save" @click="saveCustomer" />
    </template>
  </UModal>
  <!-- Invoice Modal -->
  <UModal
    v-model:open="isAddInvoiceOpen"
    :title="currentInvoice ? 'Edit Invoice' : 'Add Invoice'"
    :ui="{ width: 'sm:max-w-md', footer: 'flex justify-end gap-2' }">
    <template #body>
      <UForm :state="invoiceForm" @submit="saveInvoice" class="flex flex-wrap gap-4">
        <UFormGroup label="Invoice Number" name="number">
          <UInput v-model="invoiceForm.number" placeholder="Invoice number" required />
        </UFormGroup>
        <UFormGroup label="Date" name="date">
          <UInput v-model="invoiceForm.date" type="date" required />
        </UFormGroup>
      </UForm>
    </template>
    <template #footer>
      <UButton size="lg" color="primary" variant="solid" label="Save" @click="saveInvoice" />
    </template>
  </UModal>
  <UModal
    v-model:open="isDeleteConfirmOpen"
    :title="deleteType === 'customer' ? 'Delete Customer' : 'Delete Invoice'"
    :ui="{ width: 'sm:max-w-md', footer: 'flex justify-end gap-2' }">
    <template #body>
      <UForm v-if="deleteType === 'invoice'" :state="invoiceForm" @submit="confirmDelete" class="flex flex-wrap gap-4">
        <UFormGroup label="Invoice Number" name="number">
          <UInput v-model="invoiceForm.number" placeholder="Invoice number" readonly />
        </UFormGroup>
        <UFormGroup label="Date" name="date">
          <UInput v-model="invoiceForm.date" type="date" readonly />
        </UFormGroup>
      </UForm>
      <UForm v-else :state="customerForm" @submit="confirmDelete" class="flex flex-wrap gap-4">
        <UFormGroup label="Name" name="name">
          <UInput v-model="customerForm.name" placeholder="Customer name" readonly />
        </UFormGroup>
        <UFormGroup label="Phone" name="phone">
          <UInput v-model="customerForm.phone" placeholder="Customer phone" readonly />
        </UFormGroup>
      </UForm>
    </template>
    <template #footer>
      <div class="text-2xl font-bold tracking-widest text-center text-red-600">
        {{ deleteCode }}
      </div>
      <UInput v-model="userInputCode" class="w-full" placeholder="Enter the code above" />
      <UButton size="lg" color="error" variant="solid" label="Delete" @click="confirmDelete" />
    </template>
  </UModal>
</template>
