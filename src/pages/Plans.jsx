import React, { useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  Plus,
  SquarePen,
  Trash2,
} from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import { formatCurrency } from "../services/categories";

const nextId = () => Date.now();
const PAYMENT_METHODS = ["à vista", "parcelado"];

export default function Plans({ planningItems = [], setPlanningItems }) {
  const [showNew, setShowNew] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    name: "",
    value: "",
    paymentMethods: [],
    installments: "",
    link: "",
  });

  const toNum = (val) => Number(val || 0);
  const totalPlanned = planningItems.reduce((sum, item) => sum + toNum(item.value), 0);
  const monthlyInstallments = planningItems
    .filter(
      (item) =>
        (item.paymentMethods || []).includes("parcelado") &&
        toNum(item.installments) > 0
    )
    .reduce(
      (sum, item) => sum + toNum(item.value) / toNum(item.installments),
      0
    );

  const openNew = () => {
    setForm({
      name: "",
      value: "",
      paymentMethods: [],
      installments: "",
      link: "",
    });
    setShowNew(true);
  };

  const isValid = (item) =>
    item.name.trim() &&
    toNum(parseFloat(item.value)) > 0 &&
    item.paymentMethods.length > 0;

  const createItem = () => {
    if (!isValid(form)) return;
    setPlanningItems([
      ...planningItems,
      {
        id: nextId(),
        name: form.name.trim(),
        value: parseFloat(form.value.replace(",", ".")),
        paymentMethods: form.paymentMethods,
        installments:
          (form.paymentMethods.includes("parcelado") &&
            parseInt(form.installments, 10)) ||
          0,
        link: form.link,
      },
    ]);
    setShowNew(false);
  };

  const saveEdit = () => {
    if (!isValid(editingItem)) return;
    setPlanningItems(
      planningItems.map((item) =>
        item.id === editingItem.id
          ? {
              ...editingItem,
              value: parseFloat(String(editingItem.value).replace(",", ".")),
              installments:
                (editingItem.paymentMethods.includes("parcelado") &&
                  parseInt(editingItem.installments, 10)) ||
                0,
            }
          : item
      )
    );
    setEditingItem(null);
    setSelectedItem(null);
  };

  const deleteItem = (id) => {
    if (!window.confirm("Eliminar este item?")) return;
    setPlanningItems(planningItems.filter((item) => item.id !== id));
    setSelectedItem(null);
    setEditingItem(null);
  };

  const startEdit = (item) => {
    setEditingItem({
      ...item,
      value: String(item.value),
      installments: item.installments ? String(item.installments) : "",
      paymentMethods: item.paymentMethods || [],
    });
  };

  const toggleMethod = (item, method) => {
    const nextMethods = item.paymentMethods.includes(method)
      ? item.paymentMethods.filter((m) => m !== method)
      : [...item.paymentMethods, method];
    return { ...item, paymentMethods: nextMethods };
  };

  const itemTotal = (item) => toNum(item.value);
  const installmentAmount = (item) =>
    toNum(item.installments) > 0
      ? toNum(item.value) / toNum(item.installments)
      : 0;

  return (
    <div className="page-top">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">
          Planejamento
        </h1>
        <p className="text-[13px] text-soft mt-0.5">
          Organize compras futuras
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="card px-5 py-4">
          <p className="text-[12px] text-soft">Total planejado</p>
          <p className="text-[22px] font-semibold tnum mt-0.5">
            {formatCurrency(totalPlanned)}
          </p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-[12px] text-soft">Parcela / mês</p>
          <p className="text-[22px] font-semibold tnum mt-0.5">
            {formatCurrency(monthlyInstallments)}
          </p>
        </div>
      </div>

      {planningItems.length === 0 && (
        <div className="card mt-4 px-6 py-10 text-center">
          <p className="text-sm text-soft">Nenhum item planejado ainda.</p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {planningItems.map((item) => {
          const perMonth = installmentAmount(item);
          return (
            <div key={item.id} className="card px-5 py-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="text-[15px] font-medium truncate">
                    {item.name}
                  </h4>
                  <p className="text-[19px] font-semibold tnum mt-1">
                    {formatCurrency(itemTotal(item))}
                  </p>
                  {perMonth > 0 && (
                    <p className="text-[12px] text-soft mt-0.5 tnum">
                      {item.installments}x de {formatCurrency(perMonth)}
                    </p>
                  )}
                </div>
                {toNum(item.installments) > 0 && (
                  <span className="bg-canvas text-soft text-[12px] font-semibold px-2.5 py-1 rounded-full tnum flex-shrink-0">
                    {item.installments}x
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedItem(item)}
                className="w-full mt-3 py-2.5 bg-canvas rounded-xl text-[13px] font-semibold text-soft flex items-center justify-center gap-1.5 hover:bg-accent-soft hover:text-accent-dark transition"
              >
                Ver detalhes <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={openNew}
        className="fixed bottom-24 right-5 w-14 h-14 bg-accent rounded-full shadow-lg flex items-center justify-center active:scale-95 transition z-40"
        aria-label="Adicionar planejamento"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
      </button>

      <BottomSheet
        open={showNew}
        title="Novo item"
        onClose={() => setShowNew(false)}
      >
        <div className="space-y-3">
          <input
            className="field"
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="field"
            type="number"
            inputMode="decimal"
            placeholder="Valor (€)"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
          <div className="flex gap-3">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                onClick={() => setForm(toggleMethod(form, method))}
                className={`seg flex-1 ${
                  form.paymentMethods.includes(method)
                    ? "bg-accent-soft text-accent-dark"
                    : "bg-canvas text-soft"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
          {form.paymentMethods.includes("parcelado") && (
            <input
              className="field"
              type="number"
              inputMode="numeric"
              placeholder="Nº de parcelas"
              value={form.installments}
              onChange={(e) =>
                setForm({ ...form, installments: e.target.value })
              }
            />
          )}
          <input
            className="field"
            type="url"
            placeholder="Link (opcional)"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
          />
          <button className="btn-primary mt-2" onClick={createItem}>
            Salvar
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!selectedItem && !editingItem}
        title={selectedItem?.name || ""}
        onClose={() => setSelectedItem(null)}
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-canvas rounded-2xl px-5 py-5 text-center">
              <p className="text-[12px] text-soft">Valor total</p>
              <p className="text-[30px] font-semibold tnum mt-0.5">
                {formatCurrency(itemTotal(selectedItem))}
              </p>
              {installmentAmount(selectedItem) > 0 && (
                <p className="text-[13px] text-soft mt-1 tnum">
                  {selectedItem.installments}x de{" "}
                  {formatCurrency(installmentAmount(selectedItem))}
                </p>
              )}
            </div>

            {selectedItem.link ? (
              <a
                href={selectedItem.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full bg-accent text-white px-5 py-3.5 rounded-2xl font-semibold text-sm"
              >
                Abrir link <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <p className="text-center text-[13px] text-faint py-2">
                Sem link
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => startEdit(selectedItem)}
                className="py-3.5 bg-canvas rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-accent-soft transition"
              >
                <SquarePen className="w-4 h-4" /> Editar
              </button>
              <button
                onClick={() => deleteItem(selectedItem.id)}
                className="py-3.5 bg-canvas rounded-2xl text-sm font-semibold text-danger flex items-center justify-center gap-2 hover:bg-danger-soft transition"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={!!editingItem}
        title="Editar item"
        onClose={() => setEditingItem(null)}
      >
        {editingItem && (
          <div className="space-y-3">
            <input
              className="field"
              placeholder="Nome"
              value={editingItem.name}
              onChange={(e) =>
                setEditingItem({ ...editingItem, name: e.target.value })
              }
            />
            <input
              className="field"
              type="number"
              inputMode="decimal"
              placeholder="Valor (€)"
              value={editingItem.value}
              onChange={(e) =>
                setEditingItem({ ...editingItem, value: e.target.value })
              }
            />
            <div className="flex gap-3">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  onClick={() =>
                    setEditingItem(toggleMethod(editingItem, method))
                  }
                  className={`seg flex-1 ${
                    editingItem.paymentMethods.includes(method)
                      ? "bg-accent-soft text-accent-dark"
                      : "bg-canvas text-soft"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
            {editingItem.paymentMethods.includes("parcelado") && (
              <input
                className="field"
                type="number"
                inputMode="numeric"
                placeholder="Nº de parcelas"
                value={editingItem.installments}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    installments: e.target.value,
                  })
                }
              />
            )}
            <input
              className="field"
              type="url"
              placeholder="Link (opcional)"
              value={editingItem.link || ""}
              onChange={(e) =>
                setEditingItem({ ...editingItem, link: e.target.value })
              }
            />
            <div className="flex gap-3 mt-2">
              <button
                className="btn-secondary flex-1 !text-danger"
                onClick={() => deleteItem(editingItem.id)}
              >
                Eliminar
              </button>
              <button className="btn-primary flex-1" onClick={saveEdit}>
                Salvar
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
