import React, { useState } from "react";
import {
  Plus,
  DollarSign,
  TrendingUp,
  ChevronRight,
  X,
  ExternalLink,
  Edit,
  Trash2,
} from "lucide-react";

export default function Plans({ planningItems, setPlanningItems }) {
  const [showAddPlanning, setShowAddPlanning] = useState(false);
  const [selectedPlanningItem, setSelectedPlanningItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [newPlanning, setNewPlanning] = useState({
    name: "",
    value: "",
    paymentMethods: [],
    installments: "",
    link: "",
  });

  /* ==========================
     CALCULOS
  =========================== */
  const totalPlanned = planningItems.reduce((sum, item) => sum + item.value, 0);

  const monthlyInstallment = planningItems
    .filter((i) => i.paymentMethods.includes("parcelado"))
    .reduce((sum, i) => sum + i.value / (i.installments || 1), 0);

  /* ==========================
     ACTIONS
  =========================== */
  const handleAddPlanning = () => {
    if (
      !newPlanning.name ||
      !newPlanning.value ||
      newPlanning.paymentMethods.length === 0
    )
      return;

    const newItem = {
      id: Date.now(),
      name: newPlanning.name,
      value: parseFloat(newPlanning.value),
      paymentMethods: newPlanning.paymentMethods,
      installments: newPlanning.paymentMethods.includes("parcelado")
        ? parseInt(newPlanning.installments) || 0
        : 0,
      link: newPlanning.link,
    };

    console.log("➕ Adicionando planning item:", newItem);
    setPlanningItems((prev) => {
      const updated = [...prev, newItem];
      console.log("📊 Total de items após adicionar:", updated.length);
      return updated;
    });

    setNewPlanning({
      name: "",
      value: "",
      paymentMethods: [],
      installments: "",
      link: "",
    });

    setShowAddPlanning(false);
  };

  const handleEditPlanning = () => {
    console.log("✏️ Editando planning item:", editingItem.id);
    setPlanningItems((prev) => {
      const updated = prev.map((item) =>
        item.id === editingItem.id ? editingItem : item
      );
      console.log("📊 Total de items após editar:", updated.length);
      return updated;
    });

    setIsEditing(false);
    setEditingItem(null);
    setSelectedPlanningItem(null);
  };

  const handleDeletePlanning = (id) => {
    if (!window.confirm("Tem certeza que deseja eliminar este item?")) return;

    console.log("🗑️ Deletando planning item:", id);
    setPlanningItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      console.log("📊 Total de items após deletar:", updated.length);
      return updated;
    });

    setSelectedPlanningItem(null);
  };

  const startEditing = (item) => {
    setEditingItem({ ...item });
    setIsEditing(true);
  };

  /* ==========================
     RENDER
  =========================== */
  return (
    <div className="flex-1 bg-gray-50 pb-20">
      {/* HEADER */}
      <div className="bg-white px-4 pt-6 pb-4 border-b">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Planejamento</h1>
        <p className="text-sm text-gray-500">Organize compras futuras</p>
      </div>

      {/* RESUMO */}
      <div className="px-4 pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg">
            <DollarSign className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-xs opacity-90 mb-1">Total</p>
            <p className="text-2xl font-bold">€{totalPlanned}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg">
            <TrendingUp className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-xs opacity-90 mb-1">Parcela/mês</p>
            <p className="text-2xl font-bold">
              €{monthlyInstallment.toFixed(0)}
            </p>
          </div>
        </div>

        {/* LISTA */}
        {planningItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm mt-8">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Nenhum planejamento
            </h3>
            <p className="text-sm text-gray-500 mb-1">
              Adicione itens que você planeja comprar
            </p>
            <p className="text-xs text-gray-400 mt-2">
              💡 Os dados são salvos automaticamente
            </p>
          </div>
        ) : (
          <>
            {planningItems.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-lg mb-1">
                      {item.name}
                    </h4>
                    <p className="text-2xl font-bold text-teal-600">
                      €{item.value}
                    </p>
                  </div>

                  {item.installments > 0 && (
                    <div className="bg-purple-100 px-3 py-1 rounded-full h-fit">
                      <p className="text-xs font-bold text-purple-700">
                        {item.installments}x
                      </p>
                    </div>
                  )}
                </div>

                {item.installments > 0 && (
                  <div className="bg-purple-50 rounded-xl p-3 mb-3">
                    <p className="text-sm text-purple-900 font-medium">
                      {item.installments}x de €
                      {(item.value / item.installments).toFixed(2)}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setSelectedPlanningItem(item)}
                  className="w-full py-3 bg-gray-50 hover:bg-teal-50 text-gray-700 rounded-xl font-medium transition flex items-center justify-center gap-2"
                >
                  <span>Ver Detalhes</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Contador de Items Salvos */}
            <div className="bg-teal-50 rounded-xl p-3 text-center border border-teal-200">
              <p className="text-sm text-teal-700">
                💾 {planningItems.length}{" "}
                {planningItems.length === 1 ? "item salvo" : "itens salvos"}
              </p>
              <p className="text-xs text-teal-600 mt-1">
                Dados persistem após fechar o app
              </p>
            </div>
          </>
        )}
      </div>

      {/* BOTÃO ADD */}
      <button
        onClick={() => setShowAddPlanning(true)}
        className="fixed bottom-24 right-4 w-16 h-16 bg-teal-600 rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition z-40"
      >
        <Plus className="w-8 h-8 text-white" strokeWidth={3} />
      </button>

      {/* MODAL ADD */}
      {showAddPlanning && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end z-50">
          <div className="bg-white rounded-t-3xl p-6 w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Novo Item</h3>
              <button
                onClick={() => setShowAddPlanning(false)}
                className="p-2 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={newPlanning.name}
                onChange={(e) =>
                  setNewPlanning({
                    ...newPlanning,
                    name: e.target.value,
                  })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-lg focus:border-teal-500 outline-none"
                placeholder="Nome"
              />

              <input
                type="number"
                value={newPlanning.value}
                onChange={(e) =>
                  setNewPlanning({
                    ...newPlanning,
                    value: e.target.value,
                  })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-lg focus:border-teal-500 outline-none"
                placeholder="Valor (€)"
              />

              <div className="space-y-2">
                {["à vista", "parcelado"].map((m) => (
                  <label
                    key={m}
                    className="flex items-center p-3 bg-gray-50 rounded-xl"
                  >
                    <input
                      type="checkbox"
                      checked={newPlanning.paymentMethods.includes(m)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewPlanning({
                            ...newPlanning,
                            paymentMethods: [...newPlanning.paymentMethods, m],
                          });
                        } else {
                          setNewPlanning({
                            ...newPlanning,
                            paymentMethods: newPlanning.paymentMethods.filter(
                              (x) => x !== m
                            ),
                          });
                        }
                      }}
                      className="w-5 h-5 mr-3"
                    />
                    <span className="capitalize">{m}</span>
                  </label>
                ))}
              </div>

              {newPlanning.paymentMethods.includes("parcelado") && (
                <input
                  type="number"
                  value={newPlanning.installments}
                  onChange={(e) =>
                    setNewPlanning({
                      ...newPlanning,
                      installments: e.target.value,
                    })
                  }
                  className="w-full px-4 py-4 border-2 border-purple-200 bg-purple-50 rounded-2xl"
                  placeholder="Nº de parcelas"
                />
              )}

              <input
                type="url"
                value={newPlanning.link}
                onChange={(e) =>
                  setNewPlanning({
                    ...newPlanning,
                    link: e.target.value,
                  })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl"
                placeholder="Link (opcional)"
              />
            </div>

            <button
              onClick={handleAddPlanning}
              className="w-full mt-6 py-4 bg-teal-600 text-white rounded-2xl font-bold text-lg active:scale-98 transition shadow-lg"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DETALHES */}
      {selectedPlanningItem && !isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="text-2xl font-bold">
                {selectedPlanningItem.name}
              </h3>
              <button
                onClick={() => setSelectedPlanningItem(null)}
                className="p-2 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Valor Total</p>
                <p className="text-4xl font-bold text-teal-600">
                  €{selectedPlanningItem.value}
                </p>
              </div>

              {selectedPlanningItem.installments > 0 && (
                <div className="bg-purple-50 rounded-2xl p-4">
                  <p className="text-sm text-purple-700 mb-2">Parcelamento</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {selectedPlanningItem.installments}x de €
                    {(
                      selectedPlanningItem.value /
                      selectedPlanningItem.installments
                    ).toFixed(2)}
                  </p>
                </div>
              )}

              {selectedPlanningItem.link ? (
                <a
                  href={selectedPlanningItem.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full bg-blue-600 text-white p-4 rounded-xl"
                >
                  <span className="font-bold">Abrir Link</span>
                  <ExternalLink className="w-5 h-5" />
                </a>
              ) : (
                <div className="text-center p-4 bg-gray-50 rounded-xl text-gray-400 text-sm">
                  Sem link
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-4">
                <button
                  onClick={() => startEditing(selectedPlanningItem)}
                  className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold"
                >
                  <Edit className="w-5 h-5" />
                  Editar
                </button>

                <button
                  onClick={() => handleDeletePlanning(selectedPlanningItem.id)}
                  className="flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl font-semibold"
                >
                  <Trash2 className="w-5 h-5" />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT */}
      {isEditing && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end z-50">
          <div className="bg-white rounded-t-3xl p-6 w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Editar Item</h3>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditingItem(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    name: e.target.value,
                  })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-lg"
                placeholder="Nome"
              />

              <input
                type="number"
                value={editingItem.value}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    value: e.target.value,
                  })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-lg"
                placeholder="Valor (€)"
              />

              <div className="space-y-2">
                {["à vista", "parcelado"].map((m) => (
                  <label
                    key={m}
                    className="flex items-center p-3 bg-gray-50 rounded-xl"
                  >
                    <input
                      type="checkbox"
                      checked={editingItem.paymentMethods.includes(m)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditingItem({
                            ...editingItem,
                            paymentMethods: [...editingItem.paymentMethods, m],
                          });
                        } else {
                          setEditingItem({
                            ...editingItem,
                            paymentMethods: editingItem.paymentMethods.filter(
                              (x) => x !== m
                            ),
                          });
                        }
                      }}
                      className="w-5 h-5 mr-3"
                    />
                    <span className="capitalize">{m}</span>
                  </label>
                ))}
              </div>

              {editingItem.paymentMethods.includes("parcelado") && (
                <input
                  type="number"
                  value={editingItem.installments}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      installments: e.target.value,
                    })
                  }
                  className="w-full px-4 py-4 border-2 border-purple-200 bg-purple-50 rounded-2xl"
                  placeholder="Nº de parcelas"
                />
              )}

              <input
                type="url"
                value={editingItem.link}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    link: e.target.value,
                  })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl"
                placeholder="Link (opcional)"
              />
            </div>

            <button
              onClick={handleEditPlanning}
              className="w-full mt-6 py-4 bg-teal-600 text-white rounded-2xl font-bold text-lg"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
