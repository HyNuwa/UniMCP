import { htmlToSnippet } from "../../shared/html.js";
import {
    getConversationMessages,
    getConversations,
    getSiteInfo,
    getUnreadConversationsCount,
} from "../client/moodle.js";
import type { AulaSession } from "../client/session.js";
import type { Conversation, MessageMember } from "../client/types.js";
import { MoodleError } from "../client/web-service.js";
import { cleanName, isoDate, richText } from "./fields.js";

/** Conversaciones de la lista: las más recientes. */
const CONVERSATIONS = 20;
/** Caracteres del último mensaje en la lista: lo justo para saber de qué se trata. */
const SNIPPET_CHARS = 120;
/** Mensajes por página de una conversación. */
export const MESSAGES_PAGE = 20;

/** Moodle numera así los tipos de conversación. */
const KINDS: Record<number, string> = { 2: "grupo", 3: "personal" };

/** Las conversaciones del usuario, o los mensajes de una. Nada de esto las marca como leídas. */
export async function messages(session: AulaSession, options: { conversation?: number; page?: number } = {}) {
    const { userid } = await getSiteInfo(session);
    if (options.conversation === undefined) {
        const [conversations, unread] = await Promise.all([
            getConversations(session, CONVERSATIONS),
            getUnreadConversationsCount(session),
        ]);
        return {
            conversacionesSinLeer: unread || undefined,
            conversaciones: conversations.map((c) => viewConversation(c, userid)),
            hayMasConversaciones: conversations.length === CONVERSATIONS || undefined,
        };
    }
    return conversationMessages(session, userid, options.conversation, options.page ?? 0);
}

function viewConversation(c: Conversation, me: number) {
    const [last] = c.messages;
    const names = new Map(c.members.map((m) => [m.id, cleanName(m.fullname)]));
    return {
        conversacion: c.id,
        con: c.type === 3 ? "vos" : cleanName(c.name ?? "") || [...names.values()].join(", ") || undefined,
        tipo: KINDS[c.type],
        // En una conversación entre dos, para responder con aula_send_message.
        usuarioId: c.type === 1 && c.members.length === 1 ? c.members[0].id : undefined,
        sinLeer: c.unreadcount || undefined,
        ultimo: last && {
            de: authorOf(last.useridfrom, me, names),
            texto: htmlToSnippet(last.text, SNIPPET_CHARS),
            fecha: isoDate(last.timecreated),
        },
    };
}

async function conversationMessages(session: AulaSession, me: number, conversation: number, page: number) {
    let result: { members: MessageMember[]; messages: { useridfrom: number; text: string; timecreated: number }[] };
    try {
        result = await getConversationMessages(session, conversation, MESSAGES_PAGE, page * MESSAGES_PAGE);
    } catch (e) {
        if (!(e instanceof MoodleError)) throw e;
        throw new Error(
            `No encontré la conversación ${conversation} entre las tuyas. Los ids salen de aula_list_messages ` +
                "sin `conversacion`.",
        );
    }
    const names = new Map(result.members.map((m) => [m.id, cleanName(m.fullname)]));
    const more = result.messages.length === MESSAGES_PAGE;
    return {
        conversacion: conversation,
        pagina: page,
        // Moodle los manda del más nuevo al más viejo; se leen al revés.
        mensajes: [...result.messages].reverse().map((m) => ({
            de: authorOf(m.useridfrom, me, names),
            texto: richText(session.site, m.text),
            fecha: isoDate(m.timecreated),
        })),
        hayMasViejos: more || undefined,
        aviso: more ? `Hay mensajes más viejos: pedí \`pagina: ${page + 1}\`.` : undefined,
    };
}

function authorOf(userId: number, me: number, names: Map<number, string>): string {
    if (userId === me) return "vos";
    return names.get(userId) ?? "otro miembro";
}
