import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { Users, User, BookOpen } from 'lucide-react';

export const CreateRoomModal: React.FC = () => {
  const { modalType, closeModal, createRoom, isLoadingRoom } = useStudyRoom();
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState('');
  const [nameError, setNameError] = useState('');
  const [roomError, setRoomError] = useState('');

  const isOpen = modalType === 'create-room';

  // Always reset fields when opening modal: every account must enter their name and class name!
  useEffect(() => {
    if (isOpen) {
      setRoomName('');
      setUserName('');
      setNameError('');
      setRoomError('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    if (!roomName.trim()) {
      setRoomError('لطفاً نام کلاس را وارد کنید');
      hasError = true;
    }

    if (!userName.trim()) {
      setNameError('لطفاً نام خود را وارد کنید');
      hasError = true;
    }

    if (hasError) return;

    setRoomError('');
    setNameError('');
    createRoom(roomName.trim(), 'عمومی', userName.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="ساخت کلاس جدید"
      subtitle="نام کلاس و نام خودتان را برای ساخت کلاس وارد کنید."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Room Name Input */}
        <Input
          label="نام کلاس"
          placeholder="مثال: ریاضی عمومی ۱ یا ادبیات کنکور"
          icon={<BookOpen className="w-4 h-4" />}
          value={roomName}
          onChange={(e) => {
            setRoomName(e.target.value);
            if (roomError) setRoomError('');
          }}
          error={roomError}
          autoFocus
          required
        />

        {/* Host Name Input */}
        <Input
          label="نام شما (سازنده کلاس)"
          placeholder="مثال: علی رضایی"
          icon={<User className="w-4 h-4" />}
          value={userName}
          onChange={(e) => {
            setUserName(e.target.value);
            if (nameError) setNameError('');
          }}
          error={nameError}
          required
        />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={closeModal}>
            انصراف
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoadingRoom}
            icon={<Users className="w-4 h-4" />}
          >
            ساخت و ورود به کلاس
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateRoomModal;
