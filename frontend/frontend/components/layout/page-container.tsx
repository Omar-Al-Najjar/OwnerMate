export function PageContainer({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      className="mx-auto flex w-full max-w-[96rem] flex-col gap-5 px-4 pb-10 pt-5 md:px-6 md:pb-12 md:pt-6"
      id="main-content"
      tabIndex={-1}
    >
      {children}
    </main>
  );
}
