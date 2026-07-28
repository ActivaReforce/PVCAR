
interface EntrenadorHeaderProps {
  title: string;
}

const EntrenadorHeader = ({ title }: EntrenadorHeaderProps) => {
  return (
    <div className="flex flex-col items-start gap-4 max-w-full min-w-0">
      <div className="w-full">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">{title}</h1>
      </div>
    </div>
  );
};

export default EntrenadorHeader;
