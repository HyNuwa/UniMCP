import { withoutThirdPartyData } from "../../shared/privacy.js";
import { getSiteInfo } from "../client/moodle.js";
import type { AulaSession } from "../client/session.js";

/** Una respuesta con texto de docentes y compañeros, sin los datos personales de otros (#17). */
export async function withoutOthersData<T>(session: AulaSession, value: T): Promise<T> {
    const { fullname, username } = await getSiteInfo(session);
    return withoutThirdPartyData(value, { fullname, username });
}
