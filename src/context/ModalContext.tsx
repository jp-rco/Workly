// src/context/ModalContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import CustomModal, {
  ModalType,
  AlertVariant,
  ModalButtonConfig,
} from '../components/common/CustomModal';

interface ShowAlertParams {
  title: string;
  message?: string;
  type?: AlertVariant;
  icon?: string;
  buttonText?: string;
  onConfirm?: () => void;
}

interface ShowConfirmParams {
  title: string;
  message?: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: 'primary' | 'destructive';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ShowRoleSwitchParams {
  targetRoleName: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ShowImagePickerParams {
  title?: string;
  message?: string;
  onCamera: () => void | Promise<void>;
  onGallery: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ModalContextType {
  showAlert: (params: ShowAlertParams) => void;
  showConfirm: (params: ShowConfirmParams) => void;
  showRoleSwitch: (params: ShowRoleSwitchParams) => void;
  showImagePicker: (params: ShowImagePickerParams) => void;
  hideModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<{
    visible: boolean;
    type?: ModalType;
    variant?: AlertVariant;
    title: string;
    message?: string;
    icon?: string;
    targetRoleName?: string;
    buttons?: ModalButtonConfig[];
    onSelectCamera?: () => void;
    onSelectGallery?: () => void;
  }>({
    visible: false,
    title: '',
  });

  const hideModal = () => {
    setModalState((prev) => ({ ...prev, visible: false }));
  };

  const showAlert = ({
    title,
    message,
    type = 'info',
    icon,
    buttonText = 'Entendido',
    onConfirm,
  }: ShowAlertParams) => {
    setModalState({
      visible: true,
      type: 'alert',
      variant: type,
      title,
      message,
      icon,
      buttons: [
        {
          text: buttonText,
          style: 'primary',
          onPress: onConfirm,
        },
      ],
    });
  };

  const showConfirm = ({
    title,
    message,
    icon,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmStyle = 'primary',
    onConfirm,
    onCancel,
  }: ShowConfirmParams) => {
    setModalState({
      visible: true,
      type: 'confirm',
      variant: confirmStyle === 'destructive' ? 'error' : 'info',
      title,
      message,
      icon,
      buttons: [
        {
          text: cancelText,
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: confirmText,
          style: confirmStyle === 'destructive' ? 'destructive' : 'primary',
          onPress: onConfirm,
        },
      ],
    });
  };

  const showRoleSwitch = ({
    targetRoleName,
    onConfirm,
    onCancel,
  }: ShowRoleSwitchParams) => {
    setModalState({
      visible: true,
      type: 'role_switch',
      title: 'Cambiar de perfil',
      targetRoleName,
      buttons: [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: 'Cambiar',
          style: 'primary',
          onPress: onConfirm,
        },
      ],
    });
  };

  const showImagePicker = ({
    title = 'Seleccionar foto',
    message = '¿De dónde deseas obtener la imagen?',
    onCamera,
    onGallery,
    onCancel,
  }: ShowImagePickerParams) => {
    setModalState({
      visible: true,
      type: 'image_picker',
      title,
      message,
      onSelectCamera: onCamera,
      onSelectGallery: onGallery,
      buttons: [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: onCancel,
        },
      ],
    });
  };

  return (
    <ModalContext.Provider
      value={{
        showAlert,
        showConfirm,
        showRoleSwitch,
        showImagePicker,
        hideModal,
      }}
    >
      {children}
      <CustomModal
        visible={modalState.visible}
        type={modalState.type}
        variant={modalState.variant}
        title={modalState.title}
        message={modalState.message}
        icon={modalState.icon}
        targetRoleName={modalState.targetRoleName}
        buttons={modalState.buttons}
        onDismiss={hideModal}
        onSelectCamera={modalState.onSelectCamera}
        onSelectGallery={modalState.onSelectGallery}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
