export interface GlossaryTerm {
  id: number;
  spanish: string;
  english: string;
  definition: string;
}

export const glossaryTerms: GlossaryTerm[] = [
  { id: 1, spanish: "Activo", english: "Asset", definition: "Recurso controlado por la entidad como resultado de eventos pasados. / A resource controlled by the entity as a result of past events." },
  { id: 2, spanish: "Pasivo", english: "Liability", definition: "Obligación presente de la entidad surgida de eventos pasados. / A present obligation of the entity arising from past events." },
  { id: 3, spanish: "Patrimonio", english: "Equity", definition: "Interés residual en los activos después de deducir los pasivos. / Residual interest in assets after deducting liabilities." },
  { id: 4, spanish: "Ingreso", english: "Revenue", definition: "Incrementos en los beneficios económicos durante el periodo contable. / Increases in economic benefits during the accounting period." },
  { id: 5, spanish: "Gasto", english: "Expense", definition: "Disminuciones en los beneficios económicos durante el periodo contable. / Decreases in economic benefits during the accounting period." },
  { id: 6, spanish: "Balance General", english: "Balance Sheet", definition: "Estado financiero que muestra activos, pasivos y patrimonio. / Financial statement showing assets, liabilities, and equity." },
  { id: 7, spanish: "Estado de Resultados", english: "Income Statement", definition: "Informe que muestra ingresos, gastos y utilidad neta. / Report showing revenue, expenses, and net income." },
  { id: 8, spanish: "Flujo de Efectivo", english: "Cash Flow", definition: "Movimiento de dinero que entra y sale de la empresa. / Movement of money in and out of the business." },
  { id: 9, spanish: "Cuentas por Cobrar", english: "Accounts Receivable", definition: "Dinero que los clientes deben a la empresa. / Money owed to the company by customers." },
  { id: 10, spanish: "Cuentas por Pagar", english: "Accounts Payable", definition: "Dinero que la empresa debe a sus proveedores. / Money the company owes to its suppliers." },
  { id: 11, spanish: "Depreciación", english: "Depreciation", definition: "Distribución del costo de un activo a lo largo de su vida útil. / Allocation of the cost of an asset over its useful life." },
  { id: 12, spanish: "Amortización", english: "Amortization", definition: "Reducción gradual de una deuda o activo intangible. / Gradual reduction of a debt or intangible asset." },
  { id: 13, spanish: "Auditoría", english: "Audit", definition: "Examen sistemático de los registros financieros. / Systematic examination of financial records." },
  { id: 14, spanish: "Capital de Trabajo", english: "Working Capital", definition: "Diferencia entre activos corrientes y pasivos corrientes. / Difference between current assets and current liabilities." },
  { id: 15, spanish: "Utilidad Neta", english: "Net Income", definition: "Beneficio total después de deducir todos los gastos e impuestos. / Total profit after deducting all expenses and taxes." },
  { id: 16, spanish: "Impuesto", english: "Tax", definition: "Contribución obligatoria al estado sobre ingresos o transacciones. / Mandatory contribution to the state on income or transactions." },
  { id: 17, spanish: "Dividendo", english: "Dividend", definition: "Distribución de utilidades a los accionistas. / Distribution of profits to shareholders." },
  { id: 18, spanish: "Tasa de Interés", english: "Interest Rate", definition: "Porcentaje cobrado o pagado por el uso de dinero. / Percentage charged or paid for the use of money." },
  { id: 19, spanish: "Inventario", english: "Inventory", definition: "Bienes disponibles para la venta o producción. / Goods available for sale or production." },
  { id: 20, spanish: "Presupuesto", english: "Budget", definition: "Plan financiero que estima ingresos y gastos futuros. / Financial plan estimating future income and expenses." },
  { id: 21, spanish: "Conciliación Bancaria", english: "Bank Reconciliation", definition: "Proceso de comparar registros contables con extractos bancarios. / Process of comparing accounting records with bank statements." },
  { id: 22, spanish: "Libro Mayor", english: "General Ledger", definition: "Registro principal que contiene todas las cuentas contables. / Main record containing all accounting accounts." },
  { id: 23, spanish: "Factura", english: "Invoice", definition: "Documento que detalla una transacción de venta. / Document detailing a sales transaction." },
  { id: 24, spanish: "Margen de Utilidad", english: "Profit Margin", definition: "Porcentaje de ingresos que se convierte en ganancia. / Percentage of revenue that becomes profit." },
  { id: 25, spanish: "Provisión", english: "Provision", definition: "Pasivo de monto o fecha incierta. / Liability of uncertain amount or timing." },
];
