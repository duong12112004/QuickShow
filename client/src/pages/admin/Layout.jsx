import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Loading from "../../components/Loading";
import AdminNavbar from "../../components/admin/AdminNavbar";
import AdminSidebar from "../../components/admin/AdminSidebar";
import { useAppContext } from "../../context/AppContext";

const Layout = () => {
  const { isAdmin, fetchIsAdmin } = useAppContext();

  useEffect(() => {
    fetchIsAdmin();
  }, []);

  return isAdmin ? (
    <>
      <AdminNavbar />
      <div className="flex bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
        <AdminSidebar />
        <div className="h-[calc(100vh-64px)] flex-1 overflow-y-auto px-4 py-10 text-white md:px-10">
          <Outlet />
        </div>
      </div>
    </>
  ) : <Loading />;
};

export default Layout;
