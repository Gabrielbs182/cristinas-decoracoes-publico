/** Versão do programa. Fonte: "version" do package.json (o teste do roadmap garante que bate com a última lançada). */
import pacote from "@/package.json";

export const VERSAO: string = pacote.version;
