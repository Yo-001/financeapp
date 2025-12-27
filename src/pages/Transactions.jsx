import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

const Transaction = ({
  data,
  deleteTransaction,
  updateStatus,
  currentMonth,
}) => {
  // Ação de Excluir (Agora no lado Esquerdo para ser ativada ao deslizar para a DIREITA)
  const renderLeftActions = () => {
    return (
      <TouchableOpacity
        style={[styles.actionButton, styles.deleteButton]}
        onPress={() => deleteTransaction(data.id)}
      >
        <Ionicons name="trash-outline" size={24} color="#FFF" />
      </TouchableOpacity>
    );
  };

  // Ação de Mudar Status (Agora no lado Direito para ser ativada ao deslizar para a ESQUERDA)
  const renderRightActions = () => {
    return (
      <TouchableOpacity
        style={[styles.actionButton, styles.statusButton]}
        onPress={() => {
          // Lógica: Se estiver pago vira pendente, se estiver pendente vira pago
          const newStatus = data.status === "pago" ? "pendente" : "pago";
          updateStatus(data.id, newStatus);
        }}
      >
        <Ionicons name="swap-horizontal-outline" size={24} color="#FFF" />
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
    >
      <View style={styles.container}>
        {/* Barra lateral sem bordas nas esquinas (quadrada) */}
        <View
          style={[
            styles.indicator,
            {
              backgroundColor: data.type === "receita" ? "#2ecc71" : "#3498db",
            },
          ]}
        />

        <View style={styles.content}>
          <View>
            <Text style={styles.title}>{data.description}</Text>
            <Text style={styles.category}>{data.category}</Text>
          </View>

          <View style={styles.rightContent}>
            <Text
              style={[
                styles.amount,
                { color: data.type === "receita" ? "#2ecc71" : "#3498db" },
              ]}
            >
              {data.type === "despesa" ? "-" : ""} R$ {data.amount.toFixed(2)}
            </Text>
            <Text
              style={[
                styles.statusText,
                { color: data.status === "pago" ? "#2ecc71" : "#e74c3c" },
              ]}
            >
              {data.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    height: 70,
    marginBottom: 10,
    marginHorizontal: 15,
    borderRadius: 5,
    elevation: 2,
    overflow: "hidden", // Garante que o indicador respeite o container
  },
  indicator: {
    width: 6,
    height: "100%",
    // Bordas removidas conforme solicitado (não há borderRadius aqui)
  },
  content: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  category: {
    fontSize: 12,
    color: "#999",
  },
  rightContent: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 15,
    fontWeight: "600",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 4,
  },
  actionButton: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: 70,
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: "#e74c3c", // Cor de apagar (vermelho)
  },
  statusButton: {
    backgroundColor: "#f1c40f", // Cor de alteração de status
  },
});

export default Transaction;
