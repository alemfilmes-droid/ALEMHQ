import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  return (
    <>
      <h1 className="page-title text-foreground">Termos de Uso.</h1>
      <p>Última atualização: 1º de outubro de 2026.</p>
      <p>
        O <strong>Além HQ</strong> é um sistema interno da <strong>Além Filmes</strong>, de uso restrito à equipe e a pessoas autorizadas pela empresa. O
        acesso é pessoal e intransferível.
      </p>
      <h2>Uso</h2>
      <ul>
        <li>Use o sistema apenas para atividades de trabalho da Além Filmes.</li>
        <li>Mantenha sua senha em sigilo e avise a diretoria em caso de acesso indevido.</li>
        <li>As informações de clientes, projetos e finanças são confidenciais.</li>
      </ul>
      <h2>Integrações</h2>
      <p>
        Integrações opcionais, como o Google Agenda, são ativadas por cada pessoa e podem ser desligadas a qualquer momento. O tratamento de dados segue a{" "}
        <a href="/privacidade" className="underline underline-offset-4 hover:text-foreground">
          Política de Privacidade
        </a>
        .
      </p>
      <h2>Alterações</h2>
      <p>Estes termos podem ser atualizados pela Além Filmes; a versão vigente fica sempre nesta página.</p>
    </>
  );
}
