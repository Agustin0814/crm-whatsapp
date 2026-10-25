"use client";

import { Trash2Icon, UserPlusIcon } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { useCrm } from "@/components/crm/crm-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminUser } from "@/app/api/admin/users/route";
import { errorMessage } from "@/lib/crm/contacts";
import { ROLE_LABELS, type Role } from "@/lib/crm/types";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

async function fetchUsers(): Promise<AdminUser[] | null> {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as { users?: AdminUser[]; error?: string };
  if (!response.ok || !data.users) {
    toast.error(data.error ?? "No se pudieron cargar los usuarios");
    return null;
  }
  return data.users;
}

/** Lista de usuarios con cambio de rol, alta y baja (solo admin). */
export function UsersAdmin() {
  const supabase = createClient();
  const { me, reloadProfiles } = useCrm();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const refresh = useCallback(async () => {
    const data = await fetchUsers();
    if (data) setUsers(data);
    void reloadProfiles();
  }, [reloadProfiles]);

  useEffect(() => {
    let cancelled = false;
    fetchUsers().then((data) => {
      if (cancelled) return;
      if (data) setUsers(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeRole(user: AdminUser, role: Role) {
    if (role === user.role) return;
    // Con la sesión del admin: RLS + trigger validan el cambio en la base.
    const { error } = await supabase.from("profiles").update({ role }).eq("id", user.id);
    if (error) {
      toast.error(errorMessage(error, "No se pudo cambiar el rol"));
      return;
    }
    toast.success(`${user.full_name ?? user.email} ahora es ${ROLE_LABELS[role].toLowerCase()}`);
    await refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const response = await fetch(`/api/admin/users?id=${deleting.id}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) toast.error(data.error ?? "No se pudo eliminar el usuario");
    else {
      toast.success("Usuario eliminado");
      await refresh();
    }
    setDeleting(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Los agentes usan la bandeja; los administradores además gestionan usuarios, borran etiquetas y
          administran las respuestas rápidas.
        </p>
        <Button size="sm" onClick={() => setCreating(Date.now())}>
          <UserPlusIcon /> Nuevo usuario
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="hidden md:table-cell">Último acceso</TableHead>
              <TableHead className="w-40">Rol</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 3 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-48" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ContactAvatar seed={user.id} name={user.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {user.full_name || "Sin nombre"}
                            {user.id === me?.id && <span className="ml-1 text-xs text-muted-foreground">(tú)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Nunca"}
                    </TableCell>
                    <TableCell>
                      <Select value={user.role} onValueChange={(v) => void changeRole(user, v as Role)}>
                        <SelectTrigger size="sm" className="w-36" aria-label={`Rol de ${user.full_name ?? user.email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="agent">{ROLE_LABELS.agent}</SelectItem>
                          <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {user.id !== me?.id && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => setDeleting(user)}
                          aria-label={`Eliminar a ${user.full_name ?? user.email}`}
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {creating !== null && (
        <CreateUserDialog key={creating} onClose={() => setCreating(null)} onCreated={() => void refresh()} />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {deleting?.full_name ?? deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Perderá el acceso al CRM. Sus mensajes y notas se conservan; sus conversaciones quedarán sin asignar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName, password, role }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      toast.error(data.error ?? "No se pudo crear el usuario");
      return;
    }
    toast.success("Usuario creado. Comparte la contraseña temporal por un canal seguro.");
    onCreated();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              Podrá entrar con este correo y la contraseña temporal; luego puede cambiarla desde Supabase Auth.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nu-name">Nombre</Label>
            <Input id="nu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nu-email">Correo</Label>
            <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nu-password">Contraseña temporal</Label>
            <Input
              id="nu-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="agent">{ROLE_LABELS.agent}</SelectItem>
                <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              Crear usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
