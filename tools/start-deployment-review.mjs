import { startPerlServer } from "../server.mjs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const reviewDataDirectory = fileURLToPath(new URL("../data/deployment-review/", import.meta.url));

// Keep the presentation runtime persistent while isolating it from engineering
// release history. Explicit operator configuration always wins.
process.env.PERL_RELEASE_REPOSITORY_DIR ||= join(reviewDataDirectory, "releases");
process.env.PERL_RELEASE_ADMISSION_REPOSITORY_DIR ||= join(reviewDataDirectory, "release-admissions");
process.env.PERL_RELEASE_PROMOTION_REPOSITORY_DIR ||= join(reviewDataDirectory, "release-promotions");

const runtime = await startPerlServer({
  presentationMode: "deployment-review",
  storePath: join(reviewDataDirectory, "sandbox-state.json")
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    runtime.shutdown(signal).then(() => { process.exitCode = 0; });
  });
}
