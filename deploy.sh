rm function.zip
zip -r function.zip .
aws lambda update-function-code --function-name newContactFunction --zip-file fileb://function.zip --profile solar --region sa-east-1
