import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FUNCTION_LABELS, ROLE_LABELS } from "@/lib/auth/roles";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const profile = await requireProfile();

  return (
    <>
      <PageHeader title="Perfil." description="Suas informações visíveis para o restante da equipe." />
      <div className="grid max-w-3xl gap-6">
        <Card variant="static">
          <CardHeader>
            <CardTitle>Foto</CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarUploader userId={profile.id} name={profile.full_name} avatarUrl={profile.avatar_url} />
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm defaultValues={{ fullName: profile.full_name, phone: profile.phone ?? "" }} />
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader>
            <CardTitle>Acesso</CardTitle>
            <CardDescription>Definido pela administração. Não pode ser alterado por aqui.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={profile.email} readOnly />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Papel</p>
              <Badge variant="solid">{ROLE_LABELS[profile.access_role]}</Badge>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Funções</p>
              {profile.functions.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {profile.functions.map((fn) => (
                    <li key={fn}>
                      <Badge>{FUNCTION_LABELS[fn]}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma função atribuída.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
