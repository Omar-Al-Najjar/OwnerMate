export function PageContainer({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 md:px-8 md:py-8">
      {children}
    </main>
  );
}
