import type { AulaSite } from "../shared/campus.js";
import { withoutIds } from "../shared/logger.js";
import { getPublicConfig, getSiteInfo, getUserCourses } from "./client/moodle.js";
import type { AulaSession } from "./client/session.js";

const CHOICEGROUP = "elecciones de grupo, un plugin que no todas las aulas tienen";

/**
 * Las funciones del web service que usa cada tool del aula. Sin una de `needs` la tool no anda; sin una de
 * `partial`, anda salvo en el caso que dice (UNJu no tiene la de borrar una entrega).
 */
export const TOOL_FUNCTIONS: Record<string, { needs: string[]; partial?: Record<string, string> }> = {
    aula_get_site_info: { needs: ["core_webservice_get_site_info"] },
    aula_list_courses: { needs: ["core_enrol_get_users_courses"] },
    aula_open: {
        needs: [
            "core_enrol_get_users_courses",
            "core_course_get_contents",
            "mod_forum_get_forum_discussions",
            "mod_forum_get_discussion_posts",
            "mod_forum_can_add_discussion",
            "mod_assign_get_assignments",
            "mod_assign_get_submission_status",
            "mod_choice_get_choices_by_courses",
            "mod_choice_get_choice_options",
        ],
        partial: {
            mod_choicegroup_get_choicegroup_options: CHOICEGROUP,
            mod_quiz_get_quizzes_by_courses: "las fechas de los cuestionarios",
            mod_quiz_get_user_attempts: "los intentos hechos en un cuestionario",
        },
    },
    aula_search: {
        needs: ["core_enrol_get_users_courses", "core_course_get_contents", "mod_forum_get_forum_discussions"],
    },
    aula_list_upcoming: {
        needs: [
            "core_enrol_get_users_courses",
            "core_calendar_get_action_events_by_timesort",
            "core_calendar_get_calendar_events",
        ],
    },
    aula_list_grades: { needs: ["core_enrol_get_users_courses", "gradereport_user_get_grade_items"] },
    aula_list_updates: {
        needs: ["core_enrol_get_users_courses", "core_course_get_updates_since", "core_course_get_course_module"],
    },
    aula_list_messages: {
        needs: [
            "core_message_get_conversations",
            "core_message_get_conversation_messages",
            "core_message_get_unread_conversations_count",
        ],
    },
    // Baja archivos por pluginfile.php, sin función: depende de `downloadfiles` del sitio.
    aula_read_file: { needs: [] },
    aula_forum_post: {
        needs: [
            "core_enrol_get_users_courses",
            "core_course_get_contents",
            "mod_forum_add_discussion",
            "mod_forum_add_discussion_post",
        ],
    },
    aula_forum_edit_post: { needs: ["mod_forum_get_discussion_posts", "mod_forum_update_discussion_post"] },
    aula_forum_delete_post: { needs: ["mod_forum_get_discussion_posts", "mod_forum_delete_post"] },
    aula_choice_answer: {
        needs: [
            "core_enrol_get_users_courses",
            "core_course_get_contents",
            "mod_choice_get_choice_options",
            "mod_choice_submit_choice_response",
            "mod_choice_delete_choice_responses",
        ],
        partial: {
            mod_choicegroup_get_choicegroup_options: CHOICEGROUP,
            mod_choicegroup_submit_choicegroup_response: CHOICEGROUP,
            mod_choicegroup_delete_choicegroup_responses: CHOICEGROUP,
        },
    },
    aula_send_message: { needs: ["core_message_get_member_info", "core_message_send_instant_messages"] },
    aula_assign_submit: {
        needs: [
            "core_enrol_get_users_courses",
            "core_course_get_contents",
            "mod_assign_get_assignments",
            "mod_assign_get_submission_status",
            "mod_assign_save_submission",
            "mod_assign_submit_for_grading",
        ],
        // Sin `core_files_get_unused_draft_itemid` (Moodle < 3.11) el borrador se elige al azar.
        partial: { mod_assign_remove_submission: "borrar la entrega entera" },
    },
    aula_assign_upload_link: { needs: [] },
    aula_calendar_add_event: { needs: ["core_calendar_create_calendar_events"] },
};

/**
 * La parte del aula de `unimcp check`: si el servicio móvil está habilitado, si entra, qué Moodle es y
 * qué tools andan. Sin datos personales: ni el usuario, ni el nombre, ni los cursos (solo cuántos son).
 */
export async function checkAula(site: AulaSite, session: AulaSession): Promise<string[]> {
    const lines = [`- URL: ${site.baseUrl}`];

    try {
        const config = await getPublicConfig(site);
        const sso = config.identityproviders?.length;
        lines.push(
            `- Servicio móvil: ${config.enablemobilewebservice ? "habilitado" : "**deshabilitado**"}` +
                (config.maintenanceenabled ? " · **en mantenimiento**" : "") +
                ` · login tipo ${config.typeoflogin ?? "?"}` +
                (sso ? ` · ${sso} proveedor(es) de SSO` : ""),
        );
    } catch (e) {
        lines.push(`- Configuración pública: no se pudo leer (${withoutIds((e as Error).message)})`);
    }

    let info;
    try {
        info = await getSiteInfo(session);
    } catch (e) {
        lines.push(`- Login: **falló** (${withoutIds((e as Error).message)})`);
        return lines;
    }
    lines.push("- Login: anda", `- Moodle ${info.release ?? "?"} · ${info.functions.length} funciones habilitadas`);
    if (info.downloadfiles === 0) {
        lines.push("- **El aula no deja bajar archivos** (`downloadfiles`): aula_read_file no anda.");
    }
    if (info.uploadfiles === 0) {
        lines.push("- **El aula no deja subir archivos** (`uploadfiles`): las entregas con archivo no andan.");
    }

    try {
        lines.push(`- Cursos: ${(await getUserCourses(session)).length}`);
    } catch (e) {
        lines.push(`- Cursos: **no se pudieron listar** (${withoutIds((e as Error).message)})`);
    }

    const available = new Set(info.functions.map((f) => f.name));
    lines.push("- Tools:");
    for (const [tool, { needs, partial = {} }] of Object.entries(TOOL_FUNCTIONS)) {
        const missing = needs.filter((f) => !available.has(f));
        const cases = [...new Set(Object.keys(partial).filter((f) => !available.has(f)).map((f) => partial[f]))];
        if (missing.length) lines.push(`  - ✗ ${tool}: faltan ${missing.join(", ")}`);
        else if (cases.length) lines.push(`  - ~ ${tool}: anda, salvo ${cases.join("; ")}`);
        else lines.push(`  - ✓ ${tool}`);
    }
    return lines;
}
