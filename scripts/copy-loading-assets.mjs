import { cp, mkdir } from "node:fs/promises";

const source = new URL("../src/js/LoadingScreen/assets/", import.meta.url);
const destination = new URL(
    "../dist/js/LoadingScreen/assets/",
    import.meta.url
);

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
