import { Button } from '@renderer/components/ui/button';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';

interface VLMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VLMDialog({ open, onOpenChange }: VLMDialogProps) {
  const handleConfigureClick = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>需要配置服务商</DialogTitle>
          <DialogDescription className="text-foreground">
            缺少VLMP配置。操作符需要这些设置才能运行。 是否要配置VLMP参数？
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button type="button" onClick={handleConfigureClick}>
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
