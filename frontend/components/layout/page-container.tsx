export function PageContainer({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-col px-4 pb-8 pt-6 md:px-8 md:pb-10 md:pt-7">
      {children}
    </main>
  );
}
