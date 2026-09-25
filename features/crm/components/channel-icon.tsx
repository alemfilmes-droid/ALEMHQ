import { AtSign, Link2, Mail, MessageCircle, MoreHorizontal, Phone, Presentation, Users, Video, type LucideIcon } from "lucide-react";
import type { DealInteractionChannel } from "@/types";

const ICONS: Record<DealInteractionChannel, LucideIcon> = {
  whatsapp: MessageCircle,
  ligacao: Phone,
  email: Mail,
  instagram: AtSign,
  linkedin: Link2,
  presencial: Users,
  meet: Video,
  outro: MoreHorizontal,
};

export function ChannelIcon({ channel, className }: { channel: DealInteractionChannel | null; className?: string }) {
  const Icon = channel ? ICONS[channel] : Presentation;
  return <Icon className={className ?? "size-3.5"} aria-hidden />;
}
