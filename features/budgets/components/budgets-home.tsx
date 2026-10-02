"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createQuickProjectAction } from "@/app/(app)/projetos/actions";
import {
  createBudgetAction,
  deleteCatalogItemAction,
  getClientLinksAction,
  reorderCatalogAction,
  saveCatalogItemAction,
  saveProposalProfileAction,
  toggleCatalogItemAction,
} from "@/features/budgets/actions";
import { brl, pct, SECTION_LABELS, type BudgetSection } from "@/features/budgets/pricing";
import { BUDGET_STATUS_LABELS, type CatalogItem, type ProposalProfile } from "@/features/budgets/types";
import type { BudgetListItem } from "@/features/budgets/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { Switch } from "@/components/ui/switch";
import { TabBar } from "@/components/ui/tab-bar";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "orcamentos" | "catalogo" | "perfil";
const NO_COMPANY = "__sem_cadastro__";

function parseNumber(value: string): number {
  const clean = value.trim().replace(/[^\d,.-]/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

const NO_PROJECT = "__sem_projeto__";
const NEW_PROJECT = "__novo_projeto__";

function NewBudgetDialog({ companies, open, onOpenChange }: { companies: { id: string; name: string }[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function chooseCompany(value: string) {
    const company = companies.find((item) => item.id === value);
    setCompanyId(value === NO_COMPANY ? "" : value);
    setProjectId("");
    setProjects([]);
    if (company) {
      setClientName(company.name);
      void getClientLinksAction(company.id).then((links) => setProjects(links.projects));
    }
  }

  function chooseProject(value: string) {
    if (value === NEW_PROJECT) {
      setProjectId(NEW_PROJECT);
      return;
    }
    setProjectId(value === NO_PROJECT ? "" : value);
    const project = projects.find((item) => item.id === value);
    if (project && !title.trim()) setTitle(project.name);
  }

  function create() {
    startTransition(async () => {
      let linkedProject = projectId === NEW_PROJECT ? "" : projectId;
      if (projectId === NEW_PROJECT) {
        // Projeto novo para o cliente (trabalho pode começar antes de fechar valores).
        const created = await createQuickProjectAction({ name: title.trim(), companyId: companyId || null });
        if (!created.ok) {
          toast.error(created.error);
          return;
        }
        linkedProject = created.project?.id ?? "";
      }
      const result = await createBudgetAction({ clientName, companyId, projectId: linkedProject, title });
      if (!result.ok) toast.error(result.error);
      else if (result.id) router.push(`/orcamentos/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo orçamento.</DialogTitle>
          <DialogDescription>Data de hoje e validade de 30 dias. FEE e imposto começam iguais aos do último orçamento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField id="nb-company" label="Cliente cadastrado" hint="Opcional: puxa o nome, o logo e os projetos do cliente.">
            <SearchSelect
              id="nb-company"
              value={companyId || NO_COMPANY}
              onChange={chooseCompany}
              options={[{ value: NO_COMPANY, label: "Sem cadastro" }, ...companies.map((company) => ({ value: company.id, label: company.name }))]}
              placeholder="Selecione"
            />
          </FormField>
          <FormField id="nb-client" label="Nome do cliente">
            <Input id="nb-client" value={clientName} onChange={(event) => setClientName(event.target.value)} />
          </FormField>
          {companyId ? (
            <FormField id="nb-project" label="Projeto" hint="Um projeto já cadastrado para o cliente, um novo, ou nenhum por enquanto.">
              <SearchSelect
                id="nb-project"
                value={projectId || NO_PROJECT}
                onChange={chooseProject}
                options={[
                  { value: NO_PROJECT, label: "Sem projeto por enquanto" },
                  { value: NEW_PROJECT, label: "+ Criar novo projeto (com o título abaixo)" },
                  ...projects.map((project) => ({ value: project.id, label: project.name })),
                ]}
                placeholder="Selecione"
              />
            </FormField>
          ) : null}
          <FormField id="nb-title" label="Título do orçamento" hint="Ex.: Campanha de matrículas 2027">
            <Input id="nb-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={create} loading={pending} disabled={clientName.trim().length < 2 || title.trim().length < 2}>
            Criar orçamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableCatalogRow({
  item,
  draft,
  onDraft,
  onSave,
  onDelete,
  onToggle,
  pending,
}: {
  item: CatalogItem;
  draft: { name: string; unit: string; cost: string };
  onDraft: (draft: { name: string; unit: string; cost: string }) => void;
  onSave: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
  pending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const changed = draft.name !== item.name || draft.unit !== item.unit || parseNumber(draft.cost) !== item.defaultCost;
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("border-t border-border bg-background", isDragging && "relative z-10 shadow-lg")}
    >
      <td className="w-8 px-2 py-1.5">
        <button type="button" {...attributes} {...listeners} className="cursor-grab rounded-sm p-1 text-subtle hover:text-foreground active:cursor-grabbing" aria-label={`Arrastar ${item.name}`}>
          <GripVertical className="size-4" aria-hidden />
        </button>
      </td>
      <td className="px-2 py-1.5">
        <Input aria-label="Nome" value={draft.name} onChange={(event) => onDraft({ ...draft, name: event.target.value })} className="h-8" />
      </td>
      <td className="px-2 py-1.5">
        <Input aria-label="Unidade" value={draft.unit} onChange={(event) => onDraft({ ...draft, unit: event.target.value })} className="h-8" />
      </td>
      <td className="px-2 py-1.5">
        <Input aria-label="Custo padrão" inputMode="decimal" value={draft.cost} onChange={(event) => onDraft({ ...draft, cost: event.target.value })} className="h-8 text-right tabular-nums" />
      </td>
      <td className="px-2 py-1.5">
        <Switch checked={item.active} aria-label="Ativo" onCheckedChange={onToggle} />
      </td>
      <td className="px-2 py-1.5 text-right">
        <div className="flex justify-end gap-1">
          {changed ? (
            <Button type="button" size="sm" onClick={onSave} disabled={pending}>
              Salvar
            </Button>
          ) : null}
          <button type="button" onClick={onDelete} className="rounded-sm p-1.5 text-subtle hover:text-foreground" aria-label={`Apagar ${item.name}`} disabled={pending}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}

function CatalogManager({ catalog }: { catalog: CatalogItem[] }) {
  const [items, setItems] = useState(catalog);
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, { name: string; unit: string; cost: string }>>({});
  const [newItem, setNewItem] = useState<{ section: BudgetSection; name: string; unit: string; cost: string }>({ section: "profissional", name: "", unit: "diária", cost: "" });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => setItems(catalog), [catalog]);

  function draftOf(item: CatalogItem) {
    return drafts[item.id] ?? { name: item.name, unit: item.unit, cost: item.defaultCost ? item.defaultCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "" };
  }

  function save(item: CatalogItem) {
    const draft = draftOf(item);
    startTransition(async () => {
      const result = await saveCatalogItemAction(item.id, { section: item.section, name: draft.name, unit: draft.unit, defaultCost: parseNumber(draft.cost) });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function remove(item: CatalogItem) {
    if (!window.confirm(`Apagar "${item.name}" do catálogo? Orçamentos que já usam o item continuam com a linha.`)) return;
    startTransition(async () => {
      const result = await deleteCatalogItemAction(item.id);
      if (result.ok) {
        setItems((current) => current.filter((row) => row.id !== item.id));
        toast.success(result.message);
      } else {
        toast.error(result.error);
      }
    });
  }

  function onDragEnd(section: BudgetSection, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sectionItems = items.filter((item) => item.section === section);
    const from = sectionItems.findIndex((item) => item.id === active.id);
    const to = sectionItems.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(sectionItems, from, to);
    setItems((current) => [...current.filter((item) => item.section !== section), ...reordered]);
    startTransition(async () => {
      const result = await reorderCatalogAction(reordered.map((item) => item.id));
      if (!result.ok) toast.error(result.error);
    });
  }

  function add() {
    startTransition(async () => {
      const result = await saveCatalogItemAction(null, { section: newItem.section, name: newItem.name, unit: newItem.unit, defaultCost: parseNumber(newItem.cost) });
      if (result.ok) {
        toast.success(result.message);
        setNewItem({ ...newItem, name: "", cost: "" });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      {(["profissional", "custo"] as BudgetSection[]).map((section) => {
        const sectionItems = items.filter((item) => item.section === section);
        return (
          <section key={section} className="space-y-3">
            <h2 className="section-title">{SECTION_LABELS[section]}</h2>
            <p className="text-sm text-muted-foreground">Arraste pela alça para ordenar. Custo padrão para a empresa (o preço ao cliente sai do FEE de cada orçamento).</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => onDragEnd(section, event)}>
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="text-left text-[12px] text-subtle">
                      <th className="w-8" />
                      <th className="px-2 py-2 font-semibold">Nome</th>
                      <th className="w-36 px-2 py-2 font-semibold">Unidade</th>
                      <th className="w-40 px-2 py-2 text-right font-semibold">Custo padrão (R$)</th>
                      <th className="w-20 px-2 py-2 font-semibold">Ativo</th>
                      <th className="w-28" />
                    </tr>
                  </thead>
                  <SortableContext items={sectionItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {sectionItems.map((item) => (
                        <SortableCatalogRow
                          key={item.id}
                          item={item}
                          draft={draftOf(item)}
                          onDraft={(draft) => setDrafts({ ...drafts, [item.id]: draft })}
                          onSave={() => save(item)}
                          onDelete={() => remove(item)}
                          onToggle={(active) =>
                            startTransition(async () => {
                              setItems((current) => current.map((row) => (row.id === item.id ? { ...row, active } : row)));
                              const result = await toggleCatalogItemAction(item.id, active);
                              if (!result.ok) toast.error(result.error);
                            })
                          }
                          pending={pending}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            </div>
          </section>
        );
      })}

      <Card variant="static">
        <CardHeader>
          <CardTitle>Adicionar ao catálogo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <FormField id="cat-section" label="Tipo">
            <select
              id="cat-section"
              value={newItem.section}
              onChange={(event) => setNewItem({ ...newItem, section: event.target.value as BudgetSection, unit: event.target.value === "profissional" ? "diária" : "unidade" })}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="profissional">Profissional / serviço</option>
              <option value="custo">Custo</option>
            </select>
          </FormField>
          <FormField id="cat-name" label="Nome" className="md:col-span-2">
            <Input id="cat-name" value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} />
          </FormField>
          <FormField id="cat-unit" label="Unidade">
            <Input id="cat-unit" value={newItem.unit} onChange={(event) => setNewItem({ ...newItem, unit: event.target.value })} />
          </FormField>
          <FormField id="cat-cost" label="Custo (R$)">
            <Input id="cat-cost" inputMode="decimal" value={newItem.cost} onChange={(event) => setNewItem({ ...newItem, cost: event.target.value })} />
          </FormField>
          <div className="flex justify-end md:col-span-5">
            <Button type="button" onClick={add} loading={pending} disabled={newItem.name.trim().length < 2}>
              <Plus aria-hidden />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileForm({ initial }: { initial: ProposalProfile }) {
  const [profile, setProfile] = useState(initial);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof ProposalProfile>(key: K, value: ProposalProfile[K]) => setProfile((current) => ({ ...current, [key]: value }));

  function save() {
    startTransition(async () => {
      const result = await saveProposalProfileAction(profile);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <Card variant="static" className="max-w-3xl">
      <CardHeader>
        <CardTitle>Perfil da Além nas propostas</CardTitle>
        <CardDescription>Textos usados na abertura de todas as apresentações: quem é a Além e a mente por trás dela.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField id="pp-tagline" label="Assinatura">
          <Input id="pp-tagline" value={profile.tagline} onChange={(event) => set("tagline", event.target.value)} />
        </FormField>
        <FormField id="pp-about" label="Sobre a Além" hint="2 a 4 frases: o que a Além faz, para quem e com que padrão.">
          <Textarea id="pp-about" rows={4} value={profile.about} onChange={(event) => set("about", event.target.value)} />
        </FormField>
        <FormField id="pp-manifesto" label="Manifesto" hint="Usado no modelo Manifesto. Frases curtas, uma por linha.">
          <Textarea id="pp-manifesto" rows={4} value={profile.manifesto} onChange={(event) => set("manifesto", event.target.value)} />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="pp-founder" label="A mente por trás (nome)">
            <Input id="pp-founder" value={profile.founderName} onChange={(event) => set("founderName", event.target.value)} />
          </FormField>
          <FormField id="pp-role" label="Cargo">
            <Input id="pp-role" value={profile.founderRole} onChange={(event) => set("founderRole", event.target.value)} />
          </FormField>
        </div>
        <FormField id="pp-bio" label="Bio" hint="Trajetória, olhar, o que move o trabalho.">
          <Textarea id="pp-bio" rows={4} value={profile.founderBio} onChange={(event) => set("founderBio", event.target.value)} />
        </FormField>
        <FormField id="pp-photo" label="Foto (URL)" hint="Link de uma foto vertical de boa qualidade.">
          <Input id="pp-photo" value={profile.founderPhotoUrl} onChange={(event) => set("founderPhotoUrl", event.target.value)} />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="pp-proof" label="Números" hint="Ex.: +300 projetos · 8 anos">
            <Input id="pp-proof" value={profile.proof} onChange={(event) => set("proof", event.target.value)} />
          </FormField>
          <FormField id="pp-clients" label="Marcas atendidas" hint="Separadas por vírgula.">
            <Input id="pp-clients" value={profile.clients} onChange={(event) => set("clients", event.target.value)} />
          </FormField>
          <FormField id="pp-email" label="E-mail de contato">
            <Input id="pp-email" value={profile.contactEmail} onChange={(event) => set("contactEmail", event.target.value)} />
          </FormField>
          <FormField id="pp-phone" label="Telefone">
            <Input id="pp-phone" value={profile.contactPhone} onChange={(event) => set("contactPhone", event.target.value)} />
          </FormField>
          <FormField id="pp-site" label="Site">
            <Input id="pp-site" value={profile.website} onChange={(event) => set("website", event.target.value)} />
          </FormField>
          <FormField id="pp-ig" label="Instagram">
            <Input id="pp-ig" value={profile.instagram} onChange={(event) => set("instagram", event.target.value)} />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={save} loading={pending}>
            Salvar perfil
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BudgetsHome({
  budgets,
  catalog,
  profile,
  companies,
  initialTab,
}: {
  budgets: BudgetListItem[];
  catalog: CatalogItem[];
  profile: ProposalProfile;
  companies: { id: string; name: string }[];
  initialTab: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TabBar<Tab>
          label="Seções de orçamentos"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "orcamentos", label: "Orçamentos" },
            { value: "catalogo", label: "Catálogo" },
            { value: "perfil", label: "Perfil da Além" },
          ]}
        />
        {tab === "orcamentos" ? (
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Novo orçamento
          </Button>
        ) : null}
      </div>

      {tab === "orcamentos" ? (
        budgets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong px-6 py-14 text-center">
            <p className="font-bold">Nenhum orçamento ainda.</p>
            <p className="mt-1 text-sm text-muted-foreground">Comece pelo Catálogo com os custos da Além e crie o primeiro orçamento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-[12px] text-subtle">
                  <th className="px-4 py-2.5 font-semibold">Nº</th>
                  <th className="px-4 py-2.5 font-semibold">Cliente / orçamento</th>
                  <th className="px-4 py-2.5 font-semibold">Situação</th>
                  <th className="px-4 py-2.5 font-semibold">CRM / projeto</th>
                  <th className="px-4 py-2.5 font-semibold">Validade</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Valor final</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Margem</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => (
                  <tr
                    key={budget.id}
                    onClick={() => router.push(`/orcamentos/${budget.id}`)}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-surface-hover"
                  >
                    <td className="px-4 py-3 tabular-nums text-subtle">
                      {String(budget.number).padStart(4, "0")}
                      {budget.version > 1 ? <span className="block text-[11px]">v{budget.version}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/orcamentos/${budget.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold hover:underline">
                        {budget.clientName}
                      </Link>
                      <span className="block text-[12px] text-muted-foreground">{budget.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={budget.status === "aprovado" ? "solid" : "outline"}>{BUDGET_STATUS_LABELS[budget.status]}</Badge>
                      <span className="mt-1 block text-[11px] text-subtle">
                        {budget.decidedAt
                          ? `Resposta ${formatDate(budget.decidedAt.slice(0, 10))}`
                          : budget.sentAt
                            ? `Enviado ${formatDate(budget.sentAt.slice(0, 10))}`
                            : `Criado ${formatDate(budget.issueDate)}`}
                      </span>
                      {budget.statusNote ? <span className="block max-w-56 truncate text-[11px] text-subtle">“{budget.statusNote}”</span> : null}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">
                      {budget.dealTitle ? <span className="block">CRM: {budget.dealTitle}</span> : <span className="block text-subtle">Fora do CRM</span>}
                      {budget.projectName ? <span className="block">Projeto: {budget.projectName}</span> : null}
                    </td>
                    <td className="px-4 py-3">{formatDate(budget.validUntil)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{brl(budget.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{pct(budget.marginPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : tab === "catalogo" ? (
        <CatalogManager catalog={catalog} />
      ) : (
        <ProfileForm initial={profile} />
      )}

      {creating ? <NewBudgetDialog companies={companies} open onOpenChange={setCreating} /> : null}
    </div>
  );
}
