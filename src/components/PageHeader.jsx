export default function PageHeader({ title, description, action }) {
  return (
    <div className="sp-page-header">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-base">{description}</p>
        )}
      </div>
      {action && <div className="mt-4 shrink-0 sm:mt-0">{action}</div>}
    </div>
  )
}
