@echo off
cd /d "C:\Users\laksh\OneDrive\Desktop\new  cms applaiton\scb_cms_new"
dotnet tool update --global dotnet-ef
dotnet ef database update --project CPS.API --startup-project CPS.API
pause
