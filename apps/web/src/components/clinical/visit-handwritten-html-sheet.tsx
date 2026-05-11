"use client";

import type { RefObject } from "react";
import type {
  HandwrittenVisitCheckboxId,
  HandwrittenVisitFieldId,
  HandwrittenVisitSheetState,
} from "@/lib/visits/handwritten-visit-sheet";

type Props = {
  stageRef: RefObject<HTMLDivElement>;
  state: HandwrittenVisitSheetState;
  interactiveEnabled: boolean;
  registerFieldRef: (fieldId: HandwrittenVisitFieldId, node: HTMLDivElement | null) => void;
  onFieldChange: (fieldId: HandwrittenVisitFieldId, value: string) => void;
  onCheckboxChange: (checkboxId: HandwrittenVisitCheckboxId, checked: boolean) => void;
};

function LineField({
  fieldId,
  value,
  widthClass,
  interactiveEnabled,
  registerFieldRef,
  onFieldChange,
}: {
  fieldId: HandwrittenVisitFieldId;
  value: string;
  widthClass: string;
  interactiveEnabled: boolean;
  registerFieldRef: Props["registerFieldRef"];
  onFieldChange: Props["onFieldChange"];
}) {
  return (
    <div ref={(node) => registerFieldRef(fieldId, node)} className={`dotted-line ${widthClass}`}>
      <input
        className="line-input"
        value={value}
        readOnly={!interactiveEnabled}
        spellCheck={false}
        onChange={(event) => onFieldChange(fieldId, event.target.value)}
      />
    </div>
  );
}

function BoxField({
  fieldId,
  value,
  className = "",
  multiline = false,
  interactiveEnabled,
  registerFieldRef,
  onFieldChange,
}: {
  fieldId: HandwrittenVisitFieldId;
  value: string;
  className?: string;
  multiline?: boolean;
  interactiveEnabled: boolean;
  registerFieldRef: Props["registerFieldRef"];
  onFieldChange: Props["onFieldChange"];
}) {
  return (
    <div ref={(node) => registerFieldRef(fieldId, node)} className={`sheet-field-box ${className}`}>
      {multiline ? (
        <textarea
          className="sheet-textarea"
          value={value}
          readOnly={!interactiveEnabled}
          spellCheck={false}
          onChange={(event) => onFieldChange(fieldId, event.target.value)}
        />
      ) : (
        <input
          className="sheet-input"
          value={value}
          readOnly={!interactiveEnabled}
          spellCheck={false}
          onChange={(event) => onFieldChange(fieldId, event.target.value)}
        />
      )}
    </div>
  );
}

function SheetCheckbox({
  checkboxId,
  checked,
  interactiveEnabled,
  onCheckboxChange,
}: {
  checkboxId: HandwrittenVisitCheckboxId;
  checked: boolean;
  interactiveEnabled: boolean;
  onCheckboxChange: Props["onCheckboxChange"];
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={!interactiveEnabled}
      onChange={(event) => onCheckboxChange(checkboxId, event.target.checked)}
    />
  );
}

export function VisitHandwrittenHtmlSheet({
  stageRef,
  state,
  interactiveEnabled,
  registerFieldRef,
  onFieldChange,
  onCheckboxChange,
}: Props) {
  const { fields, checkboxes } = state;

  return (
    <div className="sheet-shell">
      <div ref={stageRef} className="sheet">
        <div className="header">
          <div className="logo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="top-logo"
              src="https://gnnybhybyzkovcpuyoiy.supabase.co/storage/v1/object/public/clinic-assets/platform/branding/logo.png"
              alt="GreenCoatVets logo"
            />
          </div>

          <div className="header-center">
            <div className="top-line">BIGGEST CHAIN OF VETERINARY HOSPITALS IN PUNJAB</div>

            <div className="brand">
              <div className="brand-green">GREENCOAT</div>
              <div className="brand-blue">VETS</div>
            </div>

            <div className="subheading">A Multi Speciality Veterinary Hospital</div>
            <div className="tagline">&quot;Trusted in Emergencies. Proven in Treatment.&quot;</div>
            <div className="address">
              SCO-20 (Opp. Bestech Mall) Phase-9, Industrial Area (Market), Sector-66, Mohali
              <br />
              Mob. : 96085-50006, Tel. : 0172-3563839, Email: greencoatvets@gmail.com
            </div>
            <div className="open24">(24 Hours Open)</div>
          </div>

          <div className="reg-section" />
        </div>

        <div className="info">
          <div className="row species-row">
            <div className="item">
              Canine <SheetCheckbox checkboxId="speciesCanine" checked={checkboxes.speciesCanine} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} />
            </div>
            <div className="item">
              Feline <SheetCheckbox checkboxId="speciesFeline" checked={checkboxes.speciesFeline} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} />
            </div>
            <div className="item">
              Exotic <SheetCheckbox checkboxId="speciesExotic" checked={checkboxes.speciesExotic} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} />
            </div>
            <div className="item">
              Avian <SheetCheckbox checkboxId="speciesAvian" checked={checkboxes.speciesAvian} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} />
            </div>
            <div className="item">
              Equine <SheetCheckbox checkboxId="speciesEquine" checked={checkboxes.speciesEquine} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} />
            </div>
          </div>

          <div className="row row-gap-large">
            <div className="item">
              Patient Name :{" "}
              <LineField
                fieldId="patientName"
                value={fields.patientName}
                widthClass="patient-line"
                interactiveEnabled={interactiveEnabled}
                registerFieldRef={registerFieldRef}
                onFieldChange={onFieldChange}
              />
            </div>
            <div className="item">
              Age :{" "}
              <LineField
                fieldId="age"
                value={fields.age}
                widthClass="age-line"
                interactiveEnabled={interactiveEnabled}
                registerFieldRef={registerFieldRef}
                onFieldChange={onFieldChange}
              />
            </div>
            <div className="item gender-item">
              Gender : M{" "}
              <SheetCheckbox checkboxId="genderMale" checked={checkboxes.genderMale} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /> F{" "}
              <SheetCheckbox checkboxId="genderFemale" checked={checkboxes.genderFemale} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} />
            </div>
          </div>

          <div className="row row-gap-medium">
            <div className="item">
              Owner Name :{" "}
              <LineField
                fieldId="ownerName"
                value={fields.ownerName}
                widthClass="owner-line"
                interactiveEnabled={interactiveEnabled}
                registerFieldRef={registerFieldRef}
                onFieldChange={onFieldChange}
              />
            </div>
            <div className="item">
              Mobile :{" "}
              <LineField
                fieldId="mobile"
                value={fields.mobile}
                widthClass="mobile-line"
                interactiveEnabled={interactiveEnabled}
                registerFieldRef={registerFieldRef}
                onFieldChange={onFieldChange}
              />
            </div>
            <div className="item">
              Date :
              <LineField
                fieldId="date"
                value={fields.date}
                widthClass="date-line"
                interactiveEnabled={interactiveEnabled}
                registerFieldRef={registerFieldRef}
                onFieldChange={onFieldChange}
              />
            </div>
          </div>
        </div>

        <div className="small-fields">
          <div className="row">
            <div className="small-label">CC / HP / :</div>
            <BoxField
              fieldId="ccHp"
              value={fields.ccHp}
              className="small-row-field"
              multiline
              interactiveEnabled={interactiveEnabled}
              registerFieldRef={registerFieldRef}
              onFieldChange={onFieldChange}
            />
          </div>
          <div className="row">
            <div className="small-label">Deworming :</div>
            <SheetCheckbox checkboxId="deworming" checked={checkboxes.deworming} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} />
            <BoxField
              fieldId="dewormingText"
              value={fields.dewormingText}
              className="small-checkbox-field"
              interactiveEnabled={interactiveEnabled}
              registerFieldRef={registerFieldRef}
              onFieldChange={onFieldChange}
            />
          </div>
          <div className="row row-last">
            <div className="small-label">Vaccination :</div>
            <SheetCheckbox checkboxId="vaccination" checked={checkboxes.vaccination} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} />
            <BoxField
              fieldId="vaccinationText"
              value={fields.vaccinationText}
              className="small-checkbox-field"
              interactiveEnabled={interactiveEnabled}
              registerFieldRef={registerFieldRef}
              onFieldChange={onFieldChange}
            />
          </div>
        </div>

        <div className="main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="watermark"
            src="https://gnnybhybyzkovcpuyoiy.supabase.co/storage/v1/object/public/clinic-assets/platform/branding/logo.png"
            alt=""
          />

          <div className="left">
            <div className="parameter-title">PARAMETER</div>

            <div className="param-row">
              <div className="param">RT :</div>
              <BoxField fieldId="rt" value={fields.rt} className="param-value" interactiveEnabled={interactiveEnabled} registerFieldRef={registerFieldRef} onFieldChange={onFieldChange} />
            </div>
            <div className="param-row">
              <div className="param">RR :</div>
              <BoxField fieldId="rr" value={fields.rr} className="param-value" interactiveEnabled={interactiveEnabled} registerFieldRef={registerFieldRef} onFieldChange={onFieldChange} />
            </div>
            <div className="param-row">
              <div className="param">HR :</div>
              <BoxField fieldId="hr" value={fields.hr} className="param-value" interactiveEnabled={interactiveEnabled} registerFieldRef={registerFieldRef} onFieldChange={onFieldChange} />
            </div>
            <div className="param-row">
              <div className="param">CRT :</div>
              <BoxField fieldId="crt" value={fields.crt} className="param-value" interactiveEnabled={interactiveEnabled} registerFieldRef={registerFieldRef} onFieldChange={onFieldChange} />
            </div>
            <div className="param-row">
              <div className="param">ALLERGIC :</div>
              <BoxField fieldId="allergic" value={fields.allergic} className="param-value" interactiveEnabled={interactiveEnabled} registerFieldRef={registerFieldRef} onFieldChange={onFieldChange} />
            </div>
            <div className="param-row">
              <div className="param">B/W</div>
              <BoxField fieldId="bw" value={fields.bw} className="param-value" interactiveEnabled={interactiveEnabled} registerFieldRef={registerFieldRef} onFieldChange={onFieldChange} />
            </div>

            <div className="test-title">TEST REFERRED</div>
            <div className="test-grid">
              <div className="test">CBC <SheetCheckbox checkboxId="testCBC" checked={checkboxes.testCBC} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">NSAID 6 <SheetCheckbox checkboxId="testNSAID6" checked={checkboxes.testNSAID6} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">Chem 17 <SheetCheckbox checkboxId="testCHEM17" checked={checkboxes.testCHEM17} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">Chem 15 <SheetCheckbox checkboxId="testCHEM15" checked={checkboxes.testCHEM15} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">Chem 10 <SheetCheckbox checkboxId="testCHEM10" checked={checkboxes.testCHEM10} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">SDMA <SheetCheckbox checkboxId="testSDMA" checked={checkboxes.testSDMA} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">TT4 <SheetCheckbox checkboxId="testTT4" checked={checkboxes.testTT4} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">Fru <SheetCheckbox checkboxId="testFRU" checked={checkboxes.testFRU} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">Phbr <SheetCheckbox checkboxId="testPHBR" checked={checkboxes.testPHBR} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">UPC <SheetCheckbox checkboxId="testUPC" checked={checkboxes.testUPC} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">CRP <SheetCheckbox checkboxId="testCRP" checked={checkboxes.testCRP} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">P4 <SheetCheckbox checkboxId="testP4" checked={checkboxes.testP4} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">Snap 4Dx <SheetCheckbox checkboxId="testSnap4Dx" checked={checkboxes.testSnap4Dx} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">Parvo <SheetCheckbox checkboxId="testParvo" checked={checkboxes.testParvo} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">X-Ray <SheetCheckbox checkboxId="testXRay" checked={checkboxes.testXRay} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
              <div className="test">USG <SheetCheckbox checkboxId="testUSG" checked={checkboxes.testUSG} interactiveEnabled={interactiveEnabled} onCheckboxChange={onCheckboxChange} /></div>
            </div>

            <div className="other">
              <div>Any other tests</div>
              <BoxField
                fieldId="otherTests"
                value={fields.otherTests}
                className="other-tests-field"
                multiline
                interactiveEnabled={interactiveEnabled}
                registerFieldRef={registerFieldRef}
                onFieldChange={onFieldChange}
              />
            </div>
          </div>

          <div className="right">
            <div className="physical">
              <span>Physical Examination :</span>
              <BoxField
                fieldId="physicalExamination"
                value={fields.physicalExamination}
                className="physical-field"
                multiline
                interactiveEnabled={interactiveEnabled}
                registerFieldRef={registerFieldRef}
                onFieldChange={onFieldChange}
              />
            </div>
            <div className="diagnosis">
              <div className="dx">Dx</div>
            </div>
            <BoxField
              fieldId="diagnosis"
              value={fields.diagnosis}
              className="diagnosis-field"
              multiline
              interactiveEnabled={interactiveEnabled}
              registerFieldRef={registerFieldRef}
              onFieldChange={onFieldChange}
            />
            <div className="rx">
              R<sub>x</sub>
            </div>
            <BoxField
              fieldId="prescription"
              value={fields.prescription}
              className="prescription-field"
              multiline
              interactiveEnabled={interactiveEnabled}
              registerFieldRef={registerFieldRef}
              onFieldChange={onFieldChange}
            />
          </div>
        </div>

        <div className="bottom">
          <div>Consultation valid for 3 days</div>
          <div>Doctor&apos;s Signature</div>
        </div>

        <div className="locations">
          MOHALI | KHARAR | ROPAR | SHRI MUKTSAR SAHIB | BARNALA | MOHALI TDI | NARAINGARH (HR) | SANGHRIA (RJ)
        </div>

        <div className="legal">NOT FOR MEDICO LEGAL PURPOSE</div>
      </div>

      <style jsx>{`
        .sheet-shell {
          width: 1000px;
          min-width: 1000px;
        }

        .sheet {
          width: 1000px;
          min-height: 1414px;
          margin: 0;
          background: #fff;
          padding: 22px 28px 18px;
          position: relative;
          overflow: hidden;
          font-family: "Times New Roman", serif;
          color: #2b2b2b;
        }

        .header {
          display: flex;
          align-items: flex-start;
          border-bottom: 2px solid #545454;
          padding-bottom: 8px;
        }

        .logo-wrap {
          width: 150px;
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
        }

        .top-logo {
          width: 115px;
          object-fit: contain;
          margin-top: 5px;
        }

        .header-center {
          flex: 1;
          text-align: center;
          color: #24386f;
        }

        .top-line {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.2px;
          margin-top: 4px;
        }

        .brand {
          margin-top: 4px;
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: baseline;
          gap: 15px;
          line-height: 1;
        }

        .brand-green,
        .brand-blue {
          font-size: 66px;
          font-weight: 700;
        }

        .brand-green {
          color: #79d5a7;
        }

        .brand-blue {
          color: #24386f;
        }

        .subheading {
          font-size: 21px;
          font-weight: 700;
          margin-top: 8px;
        }

        .tagline {
          color: #79d5a7;
          font-size: 15px;
          font-style: italic;
          font-weight: 700;
          margin-top: 1px;
        }

        .address {
          font-size: 14px;
          line-height: 1.4;
          font-weight: 700;
          margin-top: 6px;
        }

        .open24 {
          margin-top: 2px;
          color: #d23b2f;
          font-size: 18px;
          font-weight: 700;
        }

        .reg-section {
          width: 200px;
        }

        input[type="checkbox"] {
          appearance: none;
          -webkit-appearance: none;
          width: 32px;
          height: 20px;
          border: 2px solid #777;
          background-color: #fff;
          cursor: pointer;
          display: inline-block;
          position: relative;
          vertical-align: middle;
        }

        input[type="checkbox"]:checked {
          background-color: #f0f0f0;
        }

        input[type="checkbox"]:checked::after {
          content: "✔";
          position: absolute;
          top: -2px;
          left: 6px;
          font-size: 16px;
          color: #24386f;
        }

        input[type="checkbox"]:disabled {
          cursor: default;
        }

        .info {
          padding-top: 12px;
          border-bottom: 2px solid #555;
          padding-bottom: 8px;
        }

        .row {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
        }

        .row-last {
          margin-bottom: 0;
        }

        .row-gap-large {
          gap: 28px;
        }

        .row-gap-medium {
          gap: 10px;
        }

        .species-row {
          justify-content: space-between;
          padding-right: 75px;
        }

        .item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #24386f;
          font-weight: 700;
          font-size: 19px;
        }

        .gender-item {
          gap: 6px;
        }

        .dotted-line {
          border-bottom: 2px dotted #6b6b6b;
          min-height: 22px;
          display: flex;
          align-items: flex-end;
        }

        .patient-line {
          width: 250px;
        }

        .age-line {
          width: 85px;
        }

        .mobile-line {
          width: 190px;
        }

        .date-line {
          width: 185px;
        }

        .owner-line {
          width: 280px;
        }

        .line-input {
          width: 100%;
          border: 0;
          outline: none;
          background: transparent;
          font-size: 18px;
          font-weight: 700;
          font-family: "Times New Roman", serif;
          color: #2b2b2b;
          line-height: 1.2;
          padding: 0 2px;
        }

        .small-fields {
          padding-top: 10px;
          padding-bottom: 8px;
          border-bottom: 2px solid #555;
        }

        .small-label {
          width: 125px;
          color: #2b2b2b;
          font-size: 18px;
          font-weight: 700;
        }

        .sheet-field-box {
          border: 2px solid #777;
          background: #fff;
        }

        .sheet-input,
        .sheet-textarea {
          width: 100%;
          height: 100%;
          border: 0;
          outline: none;
          background: transparent;
          font-family: "Times New Roman", serif;
          color: #2b2b2b;
          padding: 4px 6px;
          resize: none;
          font-size: 17px;
          line-height: 1.25;
        }

        .small-row-field {
          flex: 1;
          min-height: 46px;
        }

        .small-checkbox-field {
          margin-left: 10px;
          flex: 1;
          min-height: 32px;
        }

        .main {
          display: flex;
          min-height: 820px;
          position: relative;
        }

        .watermark {
          position: absolute;
          width: 390px;
          right: 40px;
          bottom: 120px;
          opacity: 0.06;
          z-index: 0;
          pointer-events: none;
        }

        .left {
          width: 255px;
          border-right: 2px solid #555;
          padding-top: 14px;
          padding-right: 14px;
          position: relative;
          z-index: 2;
        }

        .right {
          flex: 1;
          padding-top: 14px;
          position: relative;
          z-index: 2;
        }

        .parameter-title {
          font-size: 22px;
          font-weight: 700;
          color: #2b2b2b;
          margin-bottom: 28px;
        }

        .param {
          font-size: 20px;
          font-weight: 700;
          color: #2b2b2b;
        }

        .param-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          gap: 12px;
        }

        .param-value {
          width: 118px;
          min-height: 34px;
        }

        .test-title {
          font-size: 20px;
          font-weight: 700;
          text-decoration: underline;
          color: #2b2b2b;
          margin-top: 22px;
          margin-bottom: 24px;
        }

        .test-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          row-gap: 16px;
          column-gap: 12px;
        }

        .test {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 17px;
          font-weight: 700;
          color: #2b2b2b;
          gap: 10px;
        }

        .other {
          margin-top: 34px;
          font-size: 18px;
          font-weight: 700;
          color: #2b2b2b;
          line-height: 1.5;
        }

        .other-tests-field {
          margin-top: 10px;
          min-height: 120px;
        }

        .physical {
          font-size: 20px;
          font-weight: 700;
          color: #2b2b2b;
          padding-left: 14px;
        }

        .physical-field {
          margin-top: 12px;
          min-height: 250px;
          border: 0;
        }

        .diagnosis {
          margin-top: 48px;
          border-top: 2px solid #555;
          height: 1px;
          position: relative;
        }

        .dx {
          position: absolute;
          top: -22px;
          left: 12px;
          background: #fff;
          padding: 0 3px;
          font-size: 18px;
          font-weight: 700;
        }

        .diagnosis-field {
          margin-top: 16px;
          min-height: 130px;
          border: 0;
        }

        .rx {
          margin-top: 10px;
          padding-left: 14px;
          font-size: 20px;
          font-weight: 700;
        }

        .prescription-field {
          margin-top: 10px;
          min-height: 360px;
          border: 0;
        }

        .bottom {
          border-top: 2px solid #555;
          margin-top: 10px;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          font-size: 20px;
          font-weight: 700;
          color: #2b2b2b;
        }

        .locations {
          text-align: center;
          margin-top: 10px;
          color: #79d5a7;
          font-size: 15px;
          font-weight: 700;
        }

        .legal {
          text-align: center;
          margin-top: 8px;
          color: #24386f;
          font-size: 16px;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
