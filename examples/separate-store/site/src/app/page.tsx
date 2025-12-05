import RevalidateButton from "./revalidate-button";

export default function Home() {
  return (
    <main>
      <div>
        <p>
          {Date.now()}
        </p>
        <RevalidateButton />
      </div>
    </main>
  );
}

export const dynamic = 'force-static';
