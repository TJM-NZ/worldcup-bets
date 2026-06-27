"use client";

import { createContext, useContext } from "react";
import { Workspace, Member, Team } from "@/lib/types";

interface WorkspaceContextValue {
  workspace: Workspace;
  member: Member;
  isAdmin: boolean;
  teams: Map<number, Team>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspace,
  member,
  teams,
  children,
}: {
  workspace: Workspace;
  member: Member;
  teams: Map<number, Team>;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceContext.Provider
      value={{ workspace, member, isAdmin: member.role === "admin", teams }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
