import { cacheLife } from "next/cache";
import RevalidateButton from "./revalidate-button";

export default async function Home() {
    "use cache";
    cacheLife({ stale: 30, revalidate: 60, expire: 300 });
    return (
        <main>
            <div>
                <p>{Date.now()}</p>
                <RevalidateButton />
            </div>
        </main>
    );
}
