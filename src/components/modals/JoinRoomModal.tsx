import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { LogIn, KeyRound, User } from 'lucide-react';

export const JoinRoomModal: React.FC = () => {
  const { modalType, closeModal, joinRoom, roomError, clearRoomError, isLoadingRoom } = useStudyRoom();
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [localError, setLocalError] = useState('');
  const [nameError, setNameError] = useState('');

  const isOpen = modalType === 'join-room';

  // Always reset fields when opening modal: every account must enter their name and room code!
  useEffect(() => {
    if (isOpen) {
      setRoomId('');
      setUserName('');
      setLocalError('');
      setNameError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (roomError) {
      setLocalError(roomError);
    }
  }, [roomError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = roomId.trim();
    const cleanName = userName.trim();

    let hasError = false;
    if (!cleanId) {
      setLocalError('لطفاً کد یا لینک کلاس را وارد کنید');
      hasError = true;
    }

    if (!cleanName) {
      setNameError('لطفاً نام خود را برای ورود به کلاس وارد کنید');
      hasError = true;
    }

    if (hasError) return;

    setLocalError('');
    setNameError('');
    clearRoomError();
    joinRoom(cleanId, cleanName);
  };

  const handleClose = () => {
    setRoomId('');
    setUserName('');
    setLocalError('');
    setNameError('');
    clearRoomError();
    closeModal();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="ورود به کلاس"
      subtitle="کد کلاس و نام خود را برای ورود وارد کنید."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="کد کلاس"
          placeholder="مثال: ABC123 یا MATH101"
          icon={<KeyRound className="w-4 h-4" />}
          value={roomId}
          onChange={(e) => {
            setRoomId(e.target.value);
            if (localError) setLocalError('');
            if (roomError) clearRoomError();
          }}
          error={localError || roomError || undefined}
          autoFocus
          required
        />

        <Input
          label="نام شما"
          placeholder="مثال: علی رضایی یا سارا"
          icon={<User className="w-4 h-4" />}
          value={userName}
          onChange={(e) => {
            setUserName(e.target.value);
            if (nameError) setNameError('');
          }}
          error={nameError}
          required
        />

        <p className="text-xs text-slate-500 dark:text-slate-400">
          این نام برای سایر هم‌کلاسی‌ها در لیست آنلاین و چت کلاس نمایش داده می‌شود.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            انصراف
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoadingRoom}
            icon={<LogIn className="w-4 h-4" />}
          >
            ورود به کلاس
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default JoinRoomModal;
