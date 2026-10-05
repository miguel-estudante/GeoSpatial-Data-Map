import { renderStatistics, cleanStatistics, handleBulkFile } from "./main.js";
// Filter Toggle Animations
const filters = ['severity', 'weather','weekdays'];

for (const filter of filters) {
  const toggle = document.getElementById(`${filter}-toggle`);
  const icon = document.getElementById(`${filter}-icon`);
  toggle.addEventListener('change', () => {
    icon.classList.toggle('rotate-90');
  });
}

const filterSidebar = document.getElementById('filter-sidebar');
const toggle = document.getElementById('filter-toggle');
const closeFilterButton = document.getElementById('close-filters');

const infoSidebar = document.getElementById('info-sidebar');
const infoToggle = document.getElementById('info-toggle');

const bulkBtn = document.getElementById('bulk-import-btn');
const bulkDropzone = document.getElementById('bulk-dropzone');
const bulkInner = document.getElementById('bulk-dropzone-inner');
const bulkClose = document.getElementById('bulk-dropzone-close');
const bulkInput = document.getElementById('bulk-csv-input');

toggle.addEventListener('click', () => {
  filterSidebar.classList.toggle('translate-x-[calc(100%+1vw)]');
  filterSidebar.classList.toggle('translate-x-0');
});

closeFilterButton.addEventListener('click', () => {
  filterSidebar.classList.toggle('translate-x-[calc(100%+1vw)]');
  filterSidebar.classList.toggle('translate-x-0');
});

infoSidebar.addEventListener('click', (event) => {
  if (event.target.id === 'close-info'){
    infoSidebar.classList.toggle('-translate-x-[calc(100%+1vw)]');
    infoSidebar.classList.toggle('-translate-x-0');
    cleanStatistics();
    setTimeout((renderStatistics), 300);
  }
});

infoToggle.addEventListener('click', () => {
  infoSidebar.classList.toggle('-translate-x-[calc(100%+1vw)]');
  infoSidebar.classList.toggle('-translate-x-0');
  cleanStatistics();
  setTimeout((renderStatistics), 300);
});

bulkBtn.addEventListener('click', () => {
  bulkBtn.classList.add('hidden');
  bulkDropzone.classList.remove('hidden');
});

bulkClose.addEventListener('click', () => {
  bulkDropzone.classList.add('hidden');
  bulkBtn.classList.remove('hidden');
});

bulkInner.addEventListener('click', () => {
  bulkInput.click();
});

bulkInput.addEventListener('change', () => {
  handleBulkFile(bulkInput.files[0]);
});

bulkInner.addEventListener('dragover', (e) => {
  e.preventDefault();
  bulkInner.classList.add('bg-blue-50/50', 'border-blue-400');
});

bulkInner.addEventListener('dragleave', (e) => {
  e.preventDefault();
  bulkInner.classList.remove('bg-blue-50/50', 'border-blue-400');
});

bulkInner.addEventListener('drop', (e) => {
  e.preventDefault();
  bulkInner.classList.remove('bg-blue-50/50', 'border-blue-400');
  const file = e.dataTransfer.files[0];
  handleBulkFile(file);
});







