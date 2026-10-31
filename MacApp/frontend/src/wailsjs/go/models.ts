export namespace main {
	
	export class ExtractResult {
	    outputPath: string;
	    fileName: string;
	    sizeFormatted: string;
	
	    static createFrom(source: any = {}) {
	        return new ExtractResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.outputPath = source["outputPath"];
	        this.fileName = source["fileName"];
	        this.sizeFormatted = source["sizeFormatted"];
	    }
	}
	export class FileDetails {
	    path: string;
	    name: string;
	    size: number;
	    sizeFormatted: string;
	
	    static createFrom(source: any = {}) {
	        return new FileDetails(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.size = source["size"];
	        this.sizeFormatted = source["sizeFormatted"];
	    }
	}

}

