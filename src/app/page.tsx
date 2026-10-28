export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        MeetWise
      </h1>
      <p className="max-w-md text-muted-foreground">
        Upload a meeting recording, get a structured report, and ask questions
        about it.
      </p>
    </main>
  );
}
