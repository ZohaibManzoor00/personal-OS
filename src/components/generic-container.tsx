type GenericContainerProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
  search?: React.ReactNode;
  pagination?: React.ReactNode;
  /** Full-width content rendered above the centered column (e.g. a cover banner). */
  cover?: React.ReactNode;
};

export const GenericContainer = ({
  children,
  header,
  search,
  pagination,
  cover,
}: GenericContainerProps) => {
  return (
    <div className="flex flex-col h-full">
      {cover}
      <div className="p-4 md:px-10 md:py-6 h-full">
        <div className="mx-auto max-w-7xl w-full flex flex-col gap-y-8 h-full">
          {header}
          <div className="flex flex-col gap-y-4 h-full">
            {search}
            {children}
          </div>
          {pagination}
        </div>
      </div>
    </div>
  );
};
