export default function Card({ title, children, className = '', icon: Icon, iconColor = 'bg-white/5 text-[#555]' }) {
  return (
    <div className={`bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-5 ${className}`}>
      {title && (
        <div className="flex items-center gap-2.5 mb-4">
          {Icon && (
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconColor}`}>
              <Icon size={14} />
            </div>
          )}
          <h3 className="label-upper">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}
