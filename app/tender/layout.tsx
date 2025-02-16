export default function TenderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {children}
    </div>
  )
} 