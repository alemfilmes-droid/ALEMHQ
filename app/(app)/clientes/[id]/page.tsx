import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { AddContactDialog } from "@/components/companies/add-contact-dialog";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { CompanyLogoUploader } from "@/components/companies/company-logo-uploader";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { ContactCard } from "@/components/companies/contact-card";
import { HealthDialogTrigger } from "@/components/companies/health-dialog-trigger";
import { LifecycleBadge, sourceSummary } from "@/components/companies/company-meta";
import { TierSelect } from "@/components/companies/tier-select";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { LinkTabs } from "@/components/ui/link-tabs";
import { StatusDot } from "@/components/ui/status-dot";
import { ProjectDates } from "@/components/projects/project-dates";
import { ClientMetrics } from "@/features/clients/components/client-metrics";
import { RelationshipTimeline } from "@/features/clients/components/relationship-timeline";
import { getClientOverview, getClientTimeline } from "@/features/clients/queries";
import { CompanyDealsTab } from "@/features/crm/components/company-deals-tab";
import { CompanyFinanceTab } from "@/features/finance/components/company-finance-tab";
import { getClientFinanceSummary } from "@/features/finance/queries";
import { canManageCompanyLogos, hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { MODEL_LABELS, STAGE_LABELS, TIER_LABELS } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { toInstagramUrl, toWebsiteUrl } from "@/lib/links";
import { PROJECT_STAGE_TONE } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Empresa" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ aba?: string; eventos?: string }>;

const TIMELINE_PAGE = 20;

export default async function CompanyPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const profile = await requireProfile();
  const { id } = await params;
  const { aba, eventos } = await searchParams;
  const canSeeFinance = hasCapability(profile, "finance");
  const canSeeCrm = hasCapability(profile, "crm");
  const financeTab = canSeeFinance && aba === "financeiro";
  const commercialTab = canSeeCrm && aba === "comercial";
  const canManage = hasCapability(profile, "manageCompanies");
  const canManageLogo = canManageCompanyLogos(profile);
  const timelineLimit = Math.min(Math.max(Number(eventos) || TIMELINE_PAGE, TIMELINE_PAGE), 200);

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("*, health_updater:profiles!companies_health_updated_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!company) notFound();

  const [contactsResult, projectsResult] = await Promise.all([
    supabase.from("contacts").select("*").eq("company_id", id).order("full_name"),
    supabase
      .from("projects")
      .select("id, name, stage, model, due_date, start_date, end_date")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const overviewTab = !financeTab && !commercialTab;
  const [overview, financeSummary, timeline] = overviewTab
    ? await Promise.all([
        getClientOverview(id),
        canSeeFinance ? getClientFinanceSummary(id) : Promise.resolve(null),
        getClientTimeline(id, timelineLimit),
      ])
    : [null, null, null];
  const contacts = contactsResult.data ?? [];
  const projects = projectsResult.data ?? [];
  const origin = sourceSummary(company);
  const isClient = company.lifecycle === "client";

  return (
    <>
      <PageHeader
        eyebrow={company.became_client_at ? `Cliente desde ${formatDate(company.became_client_at)}` : "Prospect"}
        title={company.name}
        description={origin ?? undefined}
        leading={
          canManageLogo ? (
            <CompanyLogoUploader companyId={company.id} companyName={company.name} logoUrl={company.logo_url} variant="compact" />
          ) : (
            <ClientAvatar name={company.name} logoUrl={company.logo_url} size="lg" />
          )
        }
        actions={
          <div className="flex items-center gap-3">
            <LifecycleBadge lifecycle={company.lifecycle} />
            {canManage ? (
              <CompanyFormDialog
                mode="edit"
                company={company}
                canManageLogo={canManageLogo}
                trigger={
                  <Button variant="secondary" size="sm">
                    <Pencil aria-hidden />
                    Editar
                  </Button>
                }
              />
            ) : null}
          </div>
        }
      />

      {canSeeFinance || canSeeCrm ? (
        <div className="mb-8">
          <LinkTabs
            label="Seções da empresa"
            tabs={[
              { href: `/clientes/${id}`, label: "Visão geral", active: !financeTab && !commercialTab },
              ...(canSeeCrm ? [{ href: `/clientes/${id}?aba=comercial`, label: "Comercial", active: commercialTab }] : []),
              ...(canSeeFinance ? [{ href: `/clientes/${id}?aba=financeiro`, label: "Financeiro", active: financeTab }] : []),
            ]}
          />
        </div>
      ) : null}

      {financeTab ? (
        <CompanyFinanceTab companyId={company.id} />
      ) : commercialTab ? (
        <CompanyDealsTab companyId={company.id} />
      ) : (
        <>
          {overview ? <ClientMetrics overview={overview} finance={financeSummary} /> : null}

          <dl className="card-grid mb-10 text-sm">
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="eyebrow">CNPJ</dt>
              <dd className="mt-1 font-semibold">{company.document ?? "—"}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="eyebrow">Cidade</dt>
              <dd className="mt-1 font-semibold">{company.city ?? "—"}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="eyebrow">Segmento</dt>
              <dd className="mt-1 font-semibold">{company.segment ?? "—"}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="eyebrow">Nível do cliente</dt>
              <dd className="mt-2">
                {isClient ? (
                  canManage ? (
                    <TierSelect companyId={company.id} tier={company.tier} />
                  ) : company.tier ? (
                    <Badge variant="outline">{TIER_LABELS[company.tier]}</Badge>
                  ) : (
                    <span className="text-muted-foreground">Não definido</span>
                  )
                ) : (
                  <span className="text-muted-foreground">Disponível quando virar cliente</span>
                )}
              </dd>
              {isClient && !company.tier && canManage ? (
                <p className="mt-2 text-[12px] text-subtle">Defina o nível deste cliente.</p>
              ) : null}
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="eyebrow">Saúde</dt>
              <dd className="mt-2 space-y-1">
                <HealthDialogTrigger company={company} canManage={canManage} />
                {company.health_note ? <p className="text-[13px] text-muted-foreground">{company.health_note}</p> : null}
                {company.health_updated_at ? (
                  <p className="text-[12px] text-subtle">
                    Atualizado {formatDate(company.health_updated_at)}
                    {company.health_updater?.full_name ? ` por ${company.health_updater.full_name}` : ""}
                  </p>
                ) : null}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="eyebrow">Instagram</dt>
              <dd className="mt-1">{company.instagram ? <ExternalLink href={toInstagramUrl(company.instagram)} label="Instagram" /> : <span className="font-semibold text-muted-foreground">—</span>}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="eyebrow">Site</dt>
              <dd className="mt-1">{company.website ? <ExternalLink href={toWebsiteUrl(company.website)} label="Site" /> : <span className="font-semibold text-muted-foreground">—</span>}</dd>
            </div>
          </dl>

          <section aria-labelledby="contacts-title" className="mb-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="contacts-title" className="section-title">
                Contatos
              </h2>
              {canManage ? <AddContactDialog companyId={company.id} /> : null}
            </div>
            {contacts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-strong p-6 text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
            ) : (
              <div className="card-grid">
                {contacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} canManage={canManage} />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="projects-title" className="space-y-4">
            <h2 id="projects-title" className="section-title">
              Projetos
            </h2>
            {projects.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-strong p-6 text-sm text-muted-foreground">Nenhum projeto para esta empresa.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {projects.map((project) => (
                  <li key={project.id}>
                    <Link href={`/projetos/${project.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-surface-raised">
                      <span className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                        <StatusDot tone={PROJECT_STAGE_TONE[project.stage]} />
                        <span className="truncate text-sm font-bold">{project.name}</span>
                      </span>
                      <Badge variant="muted">{MODEL_LABELS[project.model]}</Badge>
                      <Badge variant="outline">{STAGE_LABELS[project.stage]}</Badge>
                      <span className="text-[13px] text-muted-foreground">
                        <ProjectDates project={project} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {timeline ? (
            <RelationshipTimeline events={timeline.events} hasMore={timeline.hasMore} moreHref={`/clientes/${id}?eventos=${timelineLimit + TIMELINE_PAGE}`} />
          ) : null}
        </>
      )}
    </>
  );
}
