import { fetchFormattedCustomers, fetchCustomers } from "@/app/lib/data";
import CustomersTable from "@/app/ui/customers/table";

export default async function Page(){
  const customers = await fetchFormattedCustomers();

  return(
    <CustomersTable customers={customers}/>
  )
}