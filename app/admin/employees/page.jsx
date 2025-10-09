import NewEmployeeDialog from "../../../components/admin/employees/NewEmployeeDialog";

const AdminEmployeesPage = () => {
    return (
        <div className="p-8">
            <div className="max-w-7xl mx-auto">
                <div className="md:flex md:items-center md:justify-between">
                    <div className="flex-1 min-w-0">
                        <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
                            Gestion des employés
                        </h1>
                    </div>
                    <div className="flex mt-4 md:mt-0 md:ml-4">
                        <NewEmployeeDialog />
                    </div>
                </div>
                <section className="mt-8 py-2 sm:py-6 lg:py-8"></section>
            </div>
        </div>
    );
};

export default AdminEmployeesPage;
