import { stdin, stderr } from "node:process";
import { createInterface } from "node:readline/promises";

export async function ask(question: string): Promise<string> {
    const rl = createInterface({ input: stdin, output: stderr });
    try {
        return (await rl.question(question)).trim();
    } finally {
        rl.close();
    }
}

/**
 * Pide una contraseña mostrando un `*` por carácter. Con `UNI_SHOW_PASSWORD=1` se ve tal cual se
 * escribe, para comprobar lo que se tipeó.
 */
export function askHidden(question: string): Promise<string> {
    if (!stdin.isTTY || process.env.UNI_SHOW_PASSWORD === "1") return ask(question);

    return new Promise((resolve, reject) => {
        stderr.write(question);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding("utf8");
        let value = "";

        const onData = (chunk: string) => {
            for (const ch of chunk) {
                if (ch === "\r" || ch === "\n") {
                    done();
                    resolve(value);
                    return;
                }
                if (ch === "\u0003") {
                    done();
                    reject(new Error("Cancelado"));
                    return;
                }
                if (ch === "\u007f" || ch === "\b") {
                    if (value) stderr.write("\b \b");
                    value = value.slice(0, -1);
                } else {
                    value += ch;
                    stderr.write("*");
                }
            }
        };

        const done = () => {
            stdin.off("data", onData);
            stdin.setRawMode(false);
            stdin.pause();
            stderr.write("\n");
        };

        stdin.on("data", onData);
    });
}
