//

type SmartForm = {
  name: string;
  side: { type: 'color' | 'image'; value: string } | null;
  top: { type: 'color' | 'image'; value: string } | null;
  bottom: { type: 'color' | 'image'; value: string } | null;
  onClick: string;
  onTouch: string;
};

type Status = { type: 'success' | 'error' | null; message: string };

type SmartBlockCreateModalProps = {
  visible: boolean;
  form: SmartForm;
  status: Status;
  onChangeForm: (form: SmartForm) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function SmartBlockCreateModal({ visible, form, status, onChangeForm, onClose, onSubmit }: SmartBlockCreateModalProps) {
  if (!visible) return null;
  const isSuccess = status.type === 'success';
  return (
    <div className="absolute inset-0 z-[2100] flex items-center justify-center bg-black/70 p-6">
      <div className={`w-full max-w-[440px] rounded-2xl text-white shadow-2xl border border-white/10 ${isSuccess ? 'bg-gradient-to-br from-emerald-700/60 to-teal-700/60' : 'bg-neutral-900'}`}>
        <h3 className="px-6 pt-6 text-lg font-semibold">Create Smart Block</h3>
        <div className="grid gap-3 p-6">
          <label>
            <div className="text-xs opacity-80">Name</div>
            <input value={form.name} onChange={(e) => onChangeForm({ ...form, name: e.target.value })} className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-pink-400" />
          </label>
          <label>
            <div className="text-xs opacity-80">Side Texture (color like #ff0 or image URL)</div>
            <input placeholder="#ff9900 or https://..." onChange={(e) => {
              const v = e.target.value.trim();
              const side = v.startsWith('#') ? { type: 'color' as const, value: v } : v ? { type: 'image' as const, value: v } : null;
              onChangeForm({ ...form, side });
            }} className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-pink-400" />
          </label>
          <label>
            <div className="text-xs opacity-80">Top Texture (optional)</div>
            <input placeholder="#ffeeaa or https://..." onChange={(e) => {
              const v = e.target.value.trim();
              const top = v.startsWith('#') ? { type: 'color' as const, value: v } : v ? { type: 'image' as const, value: v } : null;
              onChangeForm({ ...form, top });
            }} className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-pink-400" />
          </label>
          <label>
            <div className="text-xs opacity-80">Bottom Texture (optional)</div>
            <input placeholder="#cc7700 or https://..." onChange={(e) => {
              const v = e.target.value.trim();
              const bottom = v.startsWith('#') ? { type: 'color' as const, value: v } : v ? { type: 'image' as const, value: v } : null;
              onChangeForm({ ...form, bottom });
            }} className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-pink-400" />
          </label>
          <label>
            <div className="text-xs opacity-80">onClick Actions JSON</div>
            <textarea value={form.onClick} onChange={(e) => onChangeForm({ ...form, onClick: e.target.value })} rows={3} className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-pink-400" />
          </label>
          <label>
            <div className="text-xs opacity-80">onTouch Actions JSON</div>
            <textarea value={form.onTouch} onChange={(e) => onChangeForm({ ...form, onTouch: e.target.value })} rows={3} className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-pink-400" />
          </label>

          {status.type && (
            <div className={`rounded-md px-3 py-2 text-sm ${status.type === 'success' ? 'bg-emerald-500/80 animate-pulse' : 'bg-red-500/80'}`}>
              {status.message}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button onClick={onClose} className="flex-1 rounded-md px-3 py-2 bg-white/10 hover:bg-white/20">Cancel</button>
            <button onClick={onSubmit} className="flex-1 rounded-md px-3 py-2 bg-gradient-to-br from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 font-medium shadow-md hover:shadow-pink-500/30">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}


