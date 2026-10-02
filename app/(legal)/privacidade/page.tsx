import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de Privacidade" };

const CONTACT = "andersonfelipevideomaker@gmail.com";

export default function PrivacyPage() {
  return (
    <>
      <h1 className="page-title text-foreground">Política de Privacidade.</h1>
      <p>Última atualização: 1º de outubro de 2026.</p>
      <p>
        O <strong>Além HQ</strong> é o sistema interno de gestão da <strong>Além Filmes</strong> (Fortaleza, CE), usado exclusivamente pela equipe da
        empresa. Esta política explica quais dados o sistema trata e como.
      </p>

      <h2>Dados que tratamos</h2>
      <ul>
        <li>Dados de cadastro da equipe: nome, e-mail, telefone, foto, cargo, squad e permissões.</li>
        <li>Dados de trabalho: projetos, pautas, tarefas, comentários, agenda, ponto, informações comerciais e financeiras da empresa.</li>
        <li>Dados de contatos de clientes cadastrados pela equipe (nome, cargo, e-mail e telefone), usados apenas para a execução dos trabalhos.</li>
        <li>Dados técnicos necessários ao funcionamento, como sessão de acesso e inscrição para notificações no aparelho.</li>
      </ul>

      <h2>Integração com o Google Agenda</h2>
      <p>Cada pessoa da equipe pode, por escolha própria, conectar a sua conta Google. Com a permissão concedida, o Além HQ:</p>
      <ul>
        <li>
          <strong>cria, atualiza e remove</strong> na agenda principal da pessoa os eventos que vêm do Além HQ (compromissos, captações e prazos de
          pautas em que ela está);
        </li>
        <li>
          <strong>lê</strong> os eventos da agenda da pessoa para exibi-los na agenda do Além HQ <strong>somente para ela mesma</strong>;
        </li>
        <li>usa o e-mail da conta Google apenas para mostrar qual conta está conectada.</li>
      </ul>
      <p>
        Os dados do Google não são vendidos, compartilhados com terceiros, usados para publicidade nem para treinar modelos de inteligência artificial.
        Os tokens de acesso ficam armazenados de forma restrita, acessíveis apenas pelo servidor do sistema. O uso de informações recebidas das APIs do
        Google segue a{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" className="underline underline-offset-4 hover:text-foreground">
          Política de Dados do Usuário dos Serviços de API do Google
        </a>
        , incluindo os requisitos de Uso Limitado.
      </p>
      <p>
        A pessoa pode desconectar a qualquer momento em Configurações → Google Agenda. Ao desconectar, o Além HQ remove da agenda dela os eventos que
        criou, revoga o acesso e apaga os dados do Google que guardava. O acesso também pode ser revogado em{" "}
        <a href="https://myaccount.google.com/permissions" className="underline underline-offset-4 hover:text-foreground">
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <h2>Para que usamos os dados</h2>
      <p>Somente para a operação interna da Além Filmes: organizar trabalhos, agenda, comunicação da equipe, gestão comercial e financeira.</p>

      <h2>Compartilhamento</h2>
      <p>
        Não compartilhamos dados com terceiros, exceto com os fornecedores de infraestrutura que hospedam o sistema (banco de dados e hospedagem), sob
        obrigações de confidencialidade, e quando exigido por lei.
      </p>

      <h2>Retenção e direitos</h2>
      <p>
        Os dados são mantidos enquanto forem necessários à operação ou a obrigações legais. Conforme a LGPD, você pode pedir acesso, correção ou exclusão
        dos seus dados pelo contato abaixo.
      </p>

      <h2>Contato</h2>
      <p>
        Além Filmes — <a href={`mailto:${CONTACT}`} className="underline underline-offset-4 hover:text-foreground">{CONTACT}</a>
      </p>
    </>
  );
}
