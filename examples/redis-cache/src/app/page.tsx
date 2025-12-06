import { cacheLife } from "next/cache";

import { ClientTime } from "./client-time";

export default async function Home() {
    "use cache";
    cacheLife({ stale: 5, revalidate: 10, expire: 10000 });

    const revalidateStateDate = new Date();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const revalidateEndDate = new Date();

    return (
        <>
            Revalidate start time:
            {revalidateStateDate.toISOString()}
            <br />
            Revalidate end time:
            {revalidateEndDate.toISOString()}
            <br />
            Client time:
            <ClientTime />
        </>
    );
}
