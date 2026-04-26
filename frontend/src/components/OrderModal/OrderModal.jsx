import React from "react";
import { Modal, ModalContent } from "@vibe/core";
import OrderForm from "./OrderForm";

export default function OrderModal({ show, boardId, onClose, onCreated }) {
  return (
    <Modal
      id="new-order-modal"
      show={show}
      onClose={onClose}
      title="New candle gift box order"
      description="Capture customer details, fragrance picks, and any inscription."
      closeButtonAriaLabel="Close"
      width="640px"
      contentSpacing
    >
      <ModalContent>
        <OrderForm
          boardId={boardId}
          onCancel={onClose}
          onCreated={onCreated}
        />
      </ModalContent>
    </Modal>
  );
}
