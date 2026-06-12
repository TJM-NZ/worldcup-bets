"use client";

import { createContext, useContext } from "react";
import { Workspace, Member } from "@/lib/types";

interface WorkspaceContextValue {
  workspace: Workspace;
  member: Member;
  isAdmin: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspace,
  member,
  children,
}: {
  workspace: Workspace;
  member: Member;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={{ workspace, member, isAdmin: member.role === "admin" }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
