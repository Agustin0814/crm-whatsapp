"use client";

import { BriefcaseIcon, MailIcon, MoreHorizontalIcon, PowerIcon, PowerOffIcon, UserPlusIcon } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/crm/contact-avatar";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminUser } from "@/app/api/admin/users/route";
import { formatDate } from "@/lib/format";
import { ASSIGNABLE_ROLES, ROLE_LABELS, isRole, type AssignableRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

async function fetchUsers(): Promise<AdminUser[] | null> {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as { users?: AdminUser[]; error?: string };
  if (!response.ok || !data.users) {
    toast.error(data.error ?? "No se pudieron cargar los usuarios");
    return null;
  }
  return data.users;
}

/** PATCH /api/admin/users. Devuelve el error (texto) o null. */
async function patchUser(body: { id: string; role?: string; jobTitle?: string | null; active?: boolean }): Promise<string | null> {
  const response = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return null;
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "No se pudo guardar el cambio";
}

function displayName(user: AdminUser): string {
  return user.full_name?.trim() || user.email || "Sin nombre";
}

/** Usuarios: invitar, cambiar rol o puesto, desactivar y reactivar (solo admin). Nada se borra. */
export function UsersAdmin() {
  const { me, reloadProfiles } = useCrm();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState<AdminUser | null>(null);

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

  async function changeRole(user: AdminUser, role: AssignableRole) {
    if (role === user.role) return;
    const error = await patchUser({ id: user.id, role });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`${displayName(user)} ahora es ${ROLE_LABELS[role].toLowerCase()}`);
    await refresh();
  }

  async function confirmToggle() {
    if (!toggling) return;
    const activate = !toggling.is_active;
    const error = await patchUser({ id: toggling.id, active: activate });
    if (error) toast.error(error);
    else {
      toast.success(activate ? `${displayName(toggling)} puede volver a entrar` : `${displayName(toggling)} ya no puede entrar`);
      await refresh();
    }
    setToggling(null);
  }

  async function resendInvite(user: AdminUser) {
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, fullName: user.full_name, role: user.role, jobTitle: user.job_title }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) toast.error(data.error ?? "No se pudo reenviar la invitación");
    else toast.success(`Invitación reenviada a ${user.email}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto-suave">
          Los usuarios entran con su correo. Al desactivar a alguien se cierra su sesión y se conserva su historial.
        </p>
        <Button size="sm" onClick={() => setInviting(Date.now())}>
          <UserPlusIcon aria-hidden /> Invitar usuario
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="hidden lg:table-cell">Puesto</TableHead>
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
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : users.map((user) => {
                  const isMe = user.id === me?.id;
                  // El proveedor solo aparece para otro superadmin, y no se gestiona desde aquí.
                  const locked = user.role === "superadmin";
                  return (
                    <TableRow key={user.id} className={cn(!user.is_active && "opacity-70")}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} />
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium">
                              <span className="truncate">{displayName(user)}</span>
                              {isMe && <span className="text-xs font-normal text-texto-suave">(tú)</span>}
                              {!user.is_active && <Badge variant="secondary">Inactivo</Badge>}
                              {user.is_active && user.invite_pending && <Badge variant="outline">Invitación pendiente</Badge>}
                            </p>
                            <p className="truncate text-xs text-texto-suave">{user.email}</p>
                            {user.job_title && <p className="truncate text-xs text-texto-suave lg:hidden">{user.job_title}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-texto-suave lg:table-cell">{user.job_title || "—"}</TableCell>
                      <TableCell className="hidden text-texto-suave md:table-cell">
                        {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Nunca"}
                      </TableCell>
                      <TableCell>
                        {locked || !isRole(user.role) ? (
                          <span className="text-sm text-texto-suave">{isRole(user.role) ? ROLE_LABELS[user.role] : user.role}</span>
                        ) : (
                          <Select
                            value={user.role}
                            onValueChange={(v) => void changeRole(user, v as AssignableRole)}
                            disabled={isMe}
                          >
                            <SelectTrigger size="sm" className="w-36" aria-label={`Rol de ${displayName(user)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {ASSIGNABLE_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {!locked && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${displayName(user)}`}>
                                <MoreHorizontalIcon aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onSelect={() => setEditingTitle(user)}>
                                <BriefcaseIcon aria-hidden /> Cambiar puesto
                              </DropdownMenuItem>
                              {user.invite_pending && user.is_active && user.email && (
                                <DropdownMenuItem onSelect={() => void resendInvite(user)}>
                                  <MailIcon aria-hidden /> Reenviar invitación
                                </DropdownMenuItem>
                              )}
                              {!isMe && (
                                <DropdownMenuItem
                                  variant={user.is_active ? "destructive" : "default"}
                                  onSelect={() => setToggling(user)}
                                >
                                  {user.is_active ? <PowerOffIcon aria-hidden /> : <PowerIcon aria-hidden />}
                                  {user.is_active ? "Desactivar" : "Reactivar"}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>

      {inviting !== null && (
        <InviteUserDialog key={inviting} onClose={() => setInviting(null)} onInvited={() => void refresh()} />
      )}
      {editingTitle && (
        <JobTitleDialog
          key={editingTitle.id}
          user={editingTitle}
          onClose={() => setEditingTitle(null)}
          onSaved={() => void refresh()}
        />
      )}

      <AlertDialog open={toggling !== null} onOpenChange={(open) => !open && setToggling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggling?.is_active ? `¿Desactivar a ${toggling && displayName(toggling)}?` : `¿Reactivar a ${toggling && displayName(toggling)}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggling?.is_active
                ? "Se cerrará su sesión en todos sus dispositivos y no podrá volver a entrar. Sus mensajes, notas e historial se conservan."
                : "Podrá volver a entrar con su correo y su contraseña de siempre."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant={toggling?.is_active ? "destructive" : "default"} onClick={() => void confirmToggle()}>
              {toggling?.is_active ? "Desactivar" : "Reactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteUserDialog({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<AssignableRole>("vendedor");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName, jobTitle, role }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      toast.error(data.error ?? "No se pudo enviar la invitación");
      return;
    }
    toast.success(`Invitación enviada a ${email}`);
    onInvited();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
            <DialogDescription>
              Le llegará un correo con un enlace para definir su contraseña y entrar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="iu-email">Correo</Label>
            <Input id="iu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="iu-name">Nombre</Label>
            <Input id="iu-name" value={fullName} maxLength={80} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="iu-title">Puesto (opcional)</Label>
              <Input id="iu-title" value={jobTitle} maxLength={60} onChange={(e) => setJobTitle(e.target.value)} placeholder="p. ej. Chofer" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Enviando…" : "Enviar invitación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JobTitleDialog({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [jobTitle, setJobTitle] = useState(user.job_title ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const error = await patchUser({ id: user.id, jobTitle: jobTitle.trim() || null });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Puesto actualizado");
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Puesto de {displayName(user)}</DialogTitle>
            <DialogDescription>Solo es informativo: los permisos los da el rol.</DialogDescription>
          </DialogHeader>
          <Input value={jobTitle} maxLength={60} onChange={(e) => setJobTitle(e.target.value)} aria-label="Puesto" autoFocus />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
