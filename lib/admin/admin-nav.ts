import {
  FolderCheck,
  FolderClosed,
  Radio,
  Settings,
  Users,
  BookMarked,
  FileChartLine,
  Group,
} from "lucide-react";

export const ADMIN_PERMISSIONS = {
  bible: "admin.bible",
  activities: "admin.activities",
  employees: "admin.employees",
  clients: "admin.clients",
  teams: "admin.teams",
  reports: "admin.reports",
  services: "admin.services",
  settings: "admin.settings",
  time_entries: "admin.time_entries",
};

export const ADMIN_LINKS = [
  {
    name: "Bible",
    href: "/admin",
    icon: BookMarked,
    permission: ADMIN_PERMISSIONS.bible,
  },
  {
    name: "Activité",
    href: "/admin/activities",
    icon: Radio,
    permission: ADMIN_PERMISSIONS.activities,
  },
  {
    name: "Employés",
    href: "/admin/employees",
    icon: Users,
    permission: ADMIN_PERMISSIONS.employees,
  },
  {
    name: "Clients",
    href: "/admin/clients",
    icon: FolderClosed,
    permission: ADMIN_PERMISSIONS.clients,
  },
  {
    name: "Équipes",
    href: "/admin/teams",
    icon: Group,
    permission: ADMIN_PERMISSIONS.teams,
  },
  {
    name: "Rapports",
    href: "/admin/reports",
    icon: FileChartLine,
    permission: ADMIN_PERMISSIONS.reports,
  },
  {
    name: "Services",
    href: "/admin/services",
    icon: FolderCheck,
    permission: ADMIN_PERMISSIONS.services,
  },
  {
    name: "Paramètres",
    href: "/admin/settings",
    icon: Settings,
    permission: ADMIN_PERMISSIONS.settings,
  },
];
