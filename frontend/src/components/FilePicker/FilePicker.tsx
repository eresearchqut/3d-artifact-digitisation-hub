import React, { useRef, useState, DragEvent, ChangeEvent } from "react";
import { Box, Flex, Text, VStack } from "@chakra-ui/react";
import { Button } from "../Button/Button";
import { UploadCloud } from "lucide-react";

export interface FilePickerProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  label?: string;
  helperText?: string;
}

export const FilePicker: React.FC<FilePickerProps> = ({
  onFileSelect,
  accept,
  label = "Upload a file",
  helperText = "Drag and drop a file here, or click to select",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      borderWidth="2px"
      borderStyle="dashed"
      borderColor={isDragging ? "blue.500" : "gray.300"}
      borderRadius="md"
      p={8}
      bg={isDragging ? "blue.50" : "transparent"}
      transition="all 0.2s"
      _hover={{ borderColor: "blue.400" }}
      cursor="pointer"
      onClick={() => inputRef.current?.click()}
    >
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept={accept}
        style={{ display: "none" }}
      />
      <VStack gap={4} align="center">
        <UploadCloud size={48} color={isDragging ? "#3182ce" : "#a0aec0"} />
        <Flex direction="column" align="center" gap={1}>
          <Text fontWeight="medium" fontSize="lg">
            {label}
          </Text>
          <Text fontSize="sm" color="gray.500">
            {helperText}
          </Text>
        </Flex>
        <Button 
          variant="secondary" 
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Select File
        </Button>
      </VStack>
    </Box>
  );
};
