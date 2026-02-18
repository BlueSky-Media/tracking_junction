import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Shield, Eye, Users, Loader2 } from "lucide-react";
import type { AllowedUser, User } from "@shared/models/auth";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"viewer" | "admin">("viewer");

  const { data: allowedUsers = [], isLoading: loadingAllowed } = useQuery<AllowedUser[]>({
    queryKey: ["/api/users/allowed"],
  });

  const { data: registeredUsers = [], isLoading: loadingRegistered } = useQuery<User[]>({
    queryKey: ["/api/users/registered"],
  });

  const addUserMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      await apiRequest("POST", "/api/users/allowed", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/allowed"] });
      setNewEmail("");
      setNewRole("viewer");
      toast({ title: "User added", description: "User has been added to the access list." });
    },
    onError: (error: Error) => {
      const msg = error.message.includes("409") ? "This email is already on the access list." : error.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const updateAllowedMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; role?: string; active?: boolean }) => {
      await apiRequest("PATCH", `/api/users/allowed/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/allowed"] });
      toast({ title: "Updated", description: "Access updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user.", variant: "destructive" });
    },
  });

  const deleteAllowedMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/allowed/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/allowed"] });
      toast({ title: "Removed", description: "User has been removed from the access list." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove user.", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await apiRequest("PATCH", `/api/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/registered"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/allowed"] });
      toast({ title: "Role updated", description: "User role has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
    },
  });

  const isAdmin = currentUser?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="access-denied">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Admin Access Required</h2>
            <p className="text-sm text-muted-foreground">
              You need admin privileges to manage users.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAddUser = () => {
    if (!newEmail.trim()) return;
    addUserMutation.mutate({ email: newEmail.trim(), role: newRole });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl" data-testid="users-page">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5" />
        <h1 className="text-xl font-semibold" data-testid="text-page-title">User Management</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-base">Add User Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Email Address</label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddUser()}
                data-testid="input-new-email"
              />
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground mb-1 block">Role</label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "viewer" | "admin")}>
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddUser}
              disabled={!newEmail.trim() || addUserMutation.isPending}
              data-testid="button-add-user"
            >
              {addUserMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              <span className="ml-1.5">Add</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Access List</CardTitle>
          <p className="text-xs text-muted-foreground">
            Users on this list can log in and access the dashboard. Only admins can manage users.
          </p>
        </CardHeader>
        <CardContent>
          {loadingAllowed ? (
            <div className="flex items-center justify-center py-8" data-testid="loading-allowed">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : allowedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center" data-testid="empty-allowed">
              No users have been added yet.
            </p>
          ) : (
            <div className="space-y-2" data-testid="allowed-users-list">
              {allowedUsers.map((au) => {
                const isSelf = au.email.toLowerCase() === currentUser?.email?.toLowerCase();
                return (
                  <div
                    key={au.id}
                    className="flex flex-wrap items-center gap-3 py-2 px-3 rounded-md border"
                    data-testid={`allowed-user-${au.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block" data-testid={`text-email-${au.id}`}>
                        {au.email}
                      </span>
                      {au.addedBy && (
                        <span className="text-xs text-muted-foreground">
                          Added by {au.addedBy}
                        </span>
                      )}
                    </div>
                    <Badge variant={au.role === "admin" ? "default" : "secondary"} data-testid={`badge-role-${au.id}`}>
                      {au.role === "admin" ? (
                        <><Shield className="w-3 h-3 mr-1" /> Admin</>
                      ) : (
                        <><Eye className="w-3 h-3 mr-1" /> Viewer</>
                      )}
                    </Badge>
                    <Badge variant={au.active ? "default" : "destructive"} data-testid={`badge-status-${au.id}`}>
                      {au.active ? "Active" : "Disabled"}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Select
                        value={au.role}
                        onValueChange={(v) => updateAllowedMutation.mutate({ id: au.id, role: v })}
                        disabled={isSelf}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs" data-testid={`select-role-${au.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateAllowedMutation.mutate({ id: au.id, active: !au.active })}
                        disabled={isSelf}
                        title={au.active ? "Disable access" : "Enable access"}
                        data-testid={`button-toggle-${au.id}`}
                      >
                        {au.active ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAllowedMutation.mutate(au.id)}
                        disabled={isSelf}
                        title="Remove from access list"
                        data-testid={`button-delete-${au.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registered Users</CardTitle>
          <p className="text-xs text-muted-foreground">
            Users who have logged in via Replit Auth. Their role here is synced from the access list.
          </p>
        </CardHeader>
        <CardContent>
          {loadingRegistered ? (
            <div className="flex items-center justify-center py-8" data-testid="loading-registered">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : registeredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center" data-testid="empty-registered">
              No users have registered yet.
            </p>
          ) : (
            <div className="space-y-2" data-testid="registered-users-list">
              {registeredUsers.filter((u) => u.email && !u.email.includes("example.com")).map((ru) => {
                const isSelf = ru.id === currentUser?.id;
                return (
                  <div
                    key={ru.id}
                    className="flex flex-wrap items-center gap-3 py-2 px-3 rounded-md border"
                    data-testid={`registered-user-${ru.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {ru.firstName} {ru.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground truncate block">
                        {ru.email}
                      </span>
                    </div>
                    <Badge variant={ru.role === "admin" ? "default" : "secondary"}>
                      {ru.role === "admin" ? (
                        <><Shield className="w-3 h-3 mr-1" /> Admin</>
                      ) : (
                        <><Eye className="w-3 h-3 mr-1" /> Viewer</>
                      )}
                    </Badge>
                    {isSelf && (
                      <Badge variant="outline">You</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
