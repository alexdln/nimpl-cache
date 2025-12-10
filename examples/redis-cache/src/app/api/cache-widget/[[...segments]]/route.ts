import { getKeys, getKeyDetails } from "@nimpl/cache-widget/route";

export const GET = async (_request: Request, { params }: { params: Promise<{ segments: string[] }> }) => {
    const { segments } = await params;

    if (!segments?.length) {
        return new Response(JSON.stringify(await getKeys()));
    }

    if (segments.length > 1) return new Response("", { status: 404 });

    return new Response(JSON.stringify(await getKeyDetails(segments[0])));
};
